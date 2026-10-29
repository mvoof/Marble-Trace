//! The downloaded engines, voices and models, and how they get there.
//!
//! Each component lives in a folder of its own under the voice folder, named by
//! its catalog id. A download is assembled in `.staging/<id>` and only renamed
//! into place once every file has matched its hash, so a folder that exists is
//! a component that is whole; `.installed.json` beside the files records the
//! hashes it was built from, so a catalog that pins a new version shows the old
//! one as outdated rather than installed.

pub mod catalog;
pub mod unpack;

use std::fmt;
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::assets::catalog::{
    catalog, Component, ComponentKind, RemoteFile, Unpack, PIPER_ENGINE, VOSK_ENGINE,
};
use crate::assets::unpack::unpack_zip;

const STAGING_DIR: &str = ".staging";
const CUSTOM_VOICES_DIR: &str = "custom-voices";
const INSTALLED_MARKER: &str = ".installed.json";
const PIPER_EXECUTABLE: &str = "piper.exe";
const VOSK_LIBRARY: &str = "libvosk.dll";
const VOICE_CONFIG_SUFFIX: &str = ".json";
const HASH_BUFFER_BYTES: usize = 64 * 1024;
const VOICE_MODEL_EXTENSION: &str = "onnx";
/// How deep a folder import looks: a downloaded voice set nests each voice in
/// `<language>/<locale>/<name>/<quality>/`.
const VOICE_FOLDER_DEPTH: usize = 6;

#[derive(Debug)]
pub enum InstallError {
    Network(String),
    /// The file arrived, but not the one the catalog pins.
    Checksum(String),
    Io(io::Error),
    Cancelled,
    /// An imported file matches no file of the component.
    NotInCatalog(PathBuf),
    /// An import left one of the component's files out.
    Missing(String),
    /// An imported voice has no `<model>.onnx.json` beside it, or one that is
    /// not a Piper voice config.
    NotAVoice(PathBuf),
}

impl fmt::Display for InstallError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Network(message) => write!(formatter, "download failed: {message}"),
            Self::Checksum(name) => write!(formatter, "{name} does not match its checksum"),
            Self::Io(error) => write!(formatter, "{error}"),
            Self::Cancelled => write!(formatter, "cancelled"),
            Self::NotInCatalog(path) => {
                write!(
                    formatter,
                    "{} is not a file of this component",
                    path.display()
                )
            }
            Self::Missing(name) => write!(formatter, "{name} is missing"),
            Self::NotAVoice(path) => write!(
                formatter,
                "{} needs a Piper voice config beside it (.onnx.json)",
                path.display()
            ),
        }
    }
}

impl From<io::Error> for InstallError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

/// How far a download has got, in bytes across all of the component's files.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Progress {
    pub component: String,
    pub done: u64,
    pub total: u64,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Eq)]
struct InstalledMarker {
    sha256: Vec<String>,
}

/// A Piper voice the user brought, not one from the catalog.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CustomVoice {
    pub name: String,
    pub model: PathBuf,
}

#[derive(Debug, Clone)]
pub struct VoiceAssets {
    root: PathBuf,
}

impl VoiceAssets {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn component_dir(&self, id: &str) -> PathBuf {
        self.root.join(id)
    }

    fn staging_dir(&self, id: &str) -> PathBuf {
        self.root.join(STAGING_DIR).join(id)
    }

    pub fn is_installed(&self, component: &Component) -> bool {
        let marker = self.component_dir(&component.id).join(INSTALLED_MARKER);
        let Ok(text) = fs::read_to_string(marker) else {
            return false;
        };
        let Ok(marker) = serde_json::from_str::<InstalledMarker>(&text) else {
            return false;
        };

        marker.sha256 == hashes_of(component)
    }

    /// Installed once, but from files this catalog no longer pins.
    pub fn is_outdated(&self, component: &Component) -> bool {
        self.component_dir(&component.id)
            .join(INSTALLED_MARKER)
            .is_file()
            && !self.is_installed(component)
    }

    pub fn remove(&self, id: &str) -> io::Result<()> {
        match fs::remove_dir_all(self.component_dir(id)) {
            Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
            _ => Ok(()),
        }
    }

    /// `piper.exe`, once the engine is installed — `None` keeps the voice off.
    pub fn piper_executable(&self) -> Option<PathBuf> {
        self.installed_file(PIPER_ENGINE, PIPER_EXECUTABLE)
    }

    /// `libvosk.dll`, loaded at runtime from here; its MinGW runtime DLLs sit
    /// beside it.
    pub fn vosk_library(&self) -> Option<PathBuf> {
        self.installed_file(VOSK_ENGINE, VOSK_LIBRARY)
    }

    /// The first installed recognition model for a language.
    pub fn vosk_model(&self, language: &str) -> Option<PathBuf> {
        catalog()
            .components
            .iter()
            .filter(|component| {
                component.kind == ComponentKind::SttModel
                    && component.language.as_deref() == Some(language)
            })
            .find(|component| self.is_installed(component))
            .map(|component| self.component_dir(&component.id))
    }

    /// The `.onnx` of an installed catalog voice.
    pub fn voice_model(&self, id: &str) -> Option<PathBuf> {
        let component = catalog().component(id)?;
        let model = component
            .files
            .iter()
            .find(|file| file.name.ends_with(".onnx"))?;

        self.installed_file(id, &model.name)
    }

    fn installed_file(&self, id: &str, name: &str) -> Option<PathBuf> {
        let component = catalog().component(id)?;
        let path = self.component_dir(id).join(name);

        (self.is_installed(component) && path.is_file()).then_some(path)
    }

    pub fn custom_voices(&self) -> Vec<CustomVoice> {
        let Ok(entries) = fs::read_dir(self.root.join(CUSTOM_VOICES_DIR)) else {
            return Vec::new();
        };
        let mut voices: Vec<CustomVoice> = entries
            .filter_map(Result::ok)
            .filter_map(|entry| {
                let name = entry.file_name().to_string_lossy().into_owned();
                let model = entry.path().join(format!("{name}.onnx"));

                model.is_file().then_some(CustomVoice { name, model })
            })
            .collect();

        voices.sort_by(|left, right| left.name.cmp(&right.name));
        voices
    }

    /// Downloads a component, file by file, from its URL or else its mirror.
    /// Nothing is in place until every file has matched its hash; a failure
    /// or a cancel leaves whatever was installed before untouched.
    pub async fn install(
        &self,
        client: &reqwest::Client,
        component: &Component,
        cancel: &AtomicBool,
        mut on_progress: impl FnMut(Progress) + Send,
    ) -> Result<(), InstallError> {
        let staging = self.staging_dir(&component.id);
        let downloads = staging.join("download");

        reset_dir(&staging)?;
        fs::create_dir_all(&downloads)?;

        let total = component.size();
        let mut done = 0;
        let result = async {
            for file in &component.files {
                let target = downloads.join(&file.name);

                done = fetch_any(client, file, &target, cancel, done, &mut |bytes| {
                    on_progress(Progress {
                        component: component.id.clone(),
                        done: bytes,
                        total,
                    });
                })
                .await?;
            }

            self.assemble(component)
        }
        .await;

        if result.is_err() {
            let _ = fs::remove_dir_all(&staging);
        }

        result
    }

    /// For a machine without the internet: the component's files, downloaded
    /// elsewhere, each recognised by its hash whatever it is called now.
    pub fn import_files(
        &self,
        component: &Component,
        paths: &[PathBuf],
    ) -> Result<(), InstallError> {
        let staging = self.staging_dir(&component.id);
        let downloads = staging.join("download");

        reset_dir(&staging)?;
        fs::create_dir_all(&downloads)?;

        let result = (|| {
            for path in paths {
                let hash = sha256_of_file(path)?;
                let file = component
                    .files
                    .iter()
                    .find(|file| file.sha256 == hash)
                    .ok_or_else(|| InstallError::NotInCatalog(path.clone()))?;

                fs::copy(path, downloads.join(&file.name))?;
            }

            if let Some(missing) = component
                .files
                .iter()
                .find(|file| !downloads.join(&file.name).is_file())
            {
                return Err(InstallError::Missing(missing.name.clone()));
            }

            self.assemble(component)
        })();

        if result.is_err() {
            let _ = fs::remove_dir_all(&staging);
        }

        result
    }

    /// A Piper voice of the user's own: `<name>.onnx` and the
    /// `<name>.onnx.json` that must sit beside it.
    pub fn import_custom_voice(&self, model: &Path) -> Result<CustomVoice, InstallError> {
        let config = PathBuf::from(format!("{}{VOICE_CONFIG_SUFFIX}", model.display()));
        let name = model
            .file_stem()
            .map(|stem| ascii_name(&stem.to_string_lossy()))
            .filter(|name| !name.is_empty())
            .ok_or_else(|| InstallError::NotAVoice(model.to_path_buf()))?;

        if !is_piper_voice_config(&config) {
            return Err(InstallError::NotAVoice(model.to_path_buf()));
        }

        let folder = self.root.join(CUSTOM_VOICES_DIR).join(&name);
        let target = folder.join(format!("{name}.onnx"));

        fs::create_dir_all(&folder)?;
        fs::copy(model, &target)?;
        fs::copy(
            &config,
            folder.join(format!("{name}.onnx{VOICE_CONFIG_SUFFIX}")),
        )?;

        Ok(CustomVoice {
            name,
            model: target,
        })
    }

    /// Every Piper voice in a folder and the folders under it — an `.onnx`
    /// with its `.onnx.json` beside it. An `.onnx` without one is skipped, not
    /// an error: a folder may hold other models too.
    pub fn import_custom_voice_folder(
        &self,
        folder: &Path,
    ) -> Result<Vec<CustomVoice>, InstallError> {
        let mut models = Vec::new();

        voice_models_in(folder, VOICE_FOLDER_DEPTH, &mut models)?;
        models.sort();

        let voices = models
            .iter()
            .filter(|model| {
                is_piper_voice_config(&PathBuf::from(format!(
                    "{}{VOICE_CONFIG_SUFFIX}",
                    model.display()
                )))
            })
            .map(|model| self.import_custom_voice(model))
            .collect::<Result<Vec<_>, _>>()?;

        if voices.is_empty() {
            return Err(InstallError::NotAVoice(folder.to_path_buf()));
        }

        Ok(voices)
    }

    pub fn remove_custom_voice(&self, name: &str) -> io::Result<()> {
        if name.is_empty() || ascii_name(name) != name || name.starts_with('.') {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("{name} is not a voice name"),
            ));
        }

        match fs::remove_dir_all(self.root.join(CUSTOM_VOICES_DIR).join(name)) {
            Err(error) if error.kind() != io::ErrorKind::NotFound => Err(error),
            _ => Ok(()),
        }
    }

    /// Turns the verified downloads into the component's folder, replacing the
    /// one that was there.
    fn assemble(&self, component: &Component) -> Result<(), InstallError> {
        let staging = self.staging_dir(&component.id);
        let downloads = staging.join("download");
        let content = staging.join("content");

        fs::create_dir_all(&content)?;

        for file in &component.files {
            let downloaded = downloads.join(&file.name);

            match file.unpack {
                Unpack::Zip => unpack_zip(&downloaded, &content)?,
                Unpack::None => fs::rename(&downloaded, content.join(&file.name))?,
            }
        }

        let marker = InstalledMarker {
            sha256: hashes_of(component),
        };

        fs::write(
            content.join(INSTALLED_MARKER),
            serde_json::to_string(&marker).map_err(io::Error::other)?,
        )?;
        self.remove(&component.id)?;
        fs::rename(&content, self.component_dir(&component.id))?;
        let _ = fs::remove_dir_all(&staging);

        Ok(())
    }
}

/// Piper reads its paths as narrow strings, so a custom voice keeps an ASCII
/// folder name whatever its file was called.
fn ascii_name(name: &str) -> String {
    name.chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || "-_.".contains(character) {
                character
            } else {
                '_'
            }
        })
        .collect()
}

fn voice_models_in(folder: &Path, depth: usize, models: &mut Vec<PathBuf>) -> io::Result<()> {
    for entry in fs::read_dir(folder)? {
        let path = entry?.path();

        if path.is_dir() {
            if depth > 0 {
                voice_models_in(&path, depth - 1, models)?;
            }
        } else if path
            .extension()
            .is_some_and(|extension| extension == VOICE_MODEL_EXTENSION)
        {
            models.push(path);
        }
    }

    Ok(())
}

fn hashes_of(component: &Component) -> Vec<String> {
    component
        .files
        .iter()
        .map(|file| file.sha256.clone())
        .collect()
}

fn reset_dir(path: &Path) -> io::Result<()> {
    match fs::remove_dir_all(path) {
        Err(error) if error.kind() != io::ErrorKind::NotFound => return Err(error),
        _ => {}
    }

    fs::create_dir_all(path)
}

fn is_piper_voice_config(path: &Path) -> bool {
    let Ok(text) = fs::read_to_string(path) else {
        return false;
    };
    let Ok(config) = serde_json::from_str::<serde_json::Value>(&text) else {
        return false;
    };

    config["audio"]["sample_rate"].is_u64()
}

/// The file from its URL, or from its mirror when the URL fails. Returns the
/// byte count across the component after it.
async fn fetch_any(
    client: &reqwest::Client,
    file: &RemoteFile,
    target: &Path,
    cancel: &AtomicBool,
    done_before: u64,
    on_bytes: &mut (dyn FnMut(u64) + Send),
) -> Result<u64, InstallError> {
    let first = fetch(
        client,
        &file.url,
        file,
        target,
        cancel,
        done_before,
        on_bytes,
    )
    .await;

    match (first, &file.mirror) {
        (Err(InstallError::Cancelled), _) => Err(InstallError::Cancelled),
        (Err(error), Some(mirror)) => {
            tracing::warn!(file = %file.name, %error, "download failed, trying the mirror");
            fetch(client, mirror, file, target, cancel, done_before, on_bytes).await
        }
        (result, _) => result,
    }
}

async fn fetch(
    client: &reqwest::Client,
    url: &str,
    file: &RemoteFile,
    target: &Path,
    cancel: &AtomicBool,
    done_before: u64,
    on_bytes: &mut (dyn FnMut(u64) + Send),
) -> Result<u64, InstallError> {
    let network = |error: reqwest::Error| InstallError::Network(error.to_string());
    let mut response = client
        .get(url)
        .send()
        .await
        .and_then(reqwest::Response::error_for_status)
        .map_err(network)?;
    let mut output = File::create(target)?;
    let mut hasher = Sha256::new();
    let mut done = done_before;

    while let Some(chunk) = response.chunk().await.map_err(network)? {
        if cancel.load(Ordering::Relaxed) {
            return Err(InstallError::Cancelled);
        }

        output.write_all(&chunk)?;
        hasher.update(&chunk);
        done += chunk.len() as u64;
        on_bytes(done);
    }

    output.flush()?;
    drop(output);

    if to_hex(&hasher.finalize()) != file.sha256 {
        let _ = fs::remove_file(target);

        return Err(InstallError::Checksum(file.name.clone()));
    }

    Ok(done)
}

pub fn sha256_of_file(path: &Path) -> io::Result<String> {
    let mut input = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0; HASH_BUFFER_BYTES];

    loop {
        let read = input.read(&mut buffer)?;

        if read == 0 {
            break;
        }

        hasher.update(&buffer[..read]);
    }

    Ok(to_hex(&hasher.finalize()))
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicBool;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    const BODY: &[u8] = b"voice model bytes";

    fn scratch(name: &str) -> PathBuf {
        let folder =
            std::env::temp_dir().join(format!("mt-voice-assets-{name}-{}", std::process::id()));

        let _ = fs::remove_dir_all(&folder);
        fs::create_dir_all(&folder).unwrap();
        folder
    }

    fn sha_of(bytes: &[u8]) -> String {
        to_hex(&Sha256::digest(bytes))
    }

    /// Answers `/ok` with `BODY`, `/wrong` with other bytes, anything else 404.
    async fn serve() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = listener.local_addr().unwrap();

        tokio::spawn(async move {
            loop {
                let Ok((mut socket, _)) = listener.accept().await else {
                    return;
                };
                let mut request = [0u8; 1024];
                let read = socket.read(&mut request).await.unwrap_or(0);
                let line = String::from_utf8_lossy(&request[..read]).to_string();
                let (status, body): (&str, &[u8]) = if line.starts_with("GET /ok ") {
                    ("200 OK", BODY)
                } else if line.starts_with("GET /wrong ") {
                    ("200 OK", b"tampered")
                } else {
                    ("404 Not Found", b"")
                };
                let head = format!(
                    "HTTP/1.1 {status}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
                    body.len()
                );

                let _ = socket.write_all(head.as_bytes()).await;
                let _ = socket.write_all(body).await;
            }
        });

        format!("http://{address}")
    }

    fn voice(base: &str, path: &str, mirror: Option<&str>) -> Component {
        Component {
            id: "test-voice".into(),
            kind: ComponentKind::TtsVoice,
            language: Some("en".into()),
            title: "Test".into(),
            license: "CC0".into(),
            license_url: String::new(),
            recommended: false,
            sample: None,
            files: vec![RemoteFile {
                name: "test.onnx".into(),
                url: format!("{base}{path}"),
                mirror: mirror.map(|mirror| format!("{base}{mirror}")),
                sha256: sha_of(BODY),
                size: BODY.len() as u64,
                unpack: Unpack::None,
            }],
        }
    }

    #[tokio::test]
    async fn installs_a_verified_download_and_reports_progress() {
        let base = serve().await;
        let folder = scratch("install");
        let assets = VoiceAssets::new(&folder);
        let component = voice(&base, "/ok", None);
        let mut last = None;

        assets
            .install(
                &reqwest::Client::new(),
                &component,
                &AtomicBool::new(false),
                |progress| last = Some(progress),
            )
            .await
            .unwrap();

        assert!(assets.is_installed(&component));
        assert_eq!(fs::read(folder.join("test-voice/test.onnx")).unwrap(), BODY);
        assert_eq!(
            last.map(|progress| (progress.done, progress.total)),
            Some((17, 17))
        );
        assert!(!folder.join(STAGING_DIR).join("test-voice").exists());

        let _ = fs::remove_dir_all(folder);
    }

    #[tokio::test]
    async fn falls_back_to_the_mirror() {
        let base = serve().await;
        let folder = scratch("mirror");
        let assets = VoiceAssets::new(&folder);
        let component = voice(&base, "/gone", Some("/ok"));

        assets
            .install(
                &reqwest::Client::new(),
                &component,
                &AtomicBool::new(false),
                |_| {},
            )
            .await
            .unwrap();

        assert!(assets.is_installed(&component));

        let _ = fs::remove_dir_all(folder);
    }

    #[tokio::test]
    async fn refuses_a_file_that_does_not_match_and_keeps_the_old_install() {
        let base = serve().await;
        let folder = scratch("checksum");
        let assets = VoiceAssets::new(&folder);
        let good = voice(&base, "/ok", None);
        let tampered = voice(&base, "/wrong", None);
        let client = reqwest::Client::new();
        let cancel = AtomicBool::new(false);

        assets
            .install(&client, &good, &cancel, |_| {})
            .await
            .unwrap();

        let error = assets
            .install(&client, &tampered, &cancel, |_| {})
            .await
            .unwrap_err();

        assert!(matches!(error, InstallError::Checksum(_)), "{error}");
        assert!(assets.is_installed(&good));
        assert!(!folder.join(STAGING_DIR).join("test-voice").exists());

        let _ = fs::remove_dir_all(folder);
    }

    #[tokio::test]
    async fn stops_when_cancelled() {
        let base = serve().await;
        let folder = scratch("cancel");
        let assets = VoiceAssets::new(&folder);
        let component = voice(&base, "/ok", None);
        let error = assets
            .install(
                &reqwest::Client::new(),
                &component,
                &AtomicBool::new(true),
                |_| {},
            )
            .await
            .unwrap_err();

        assert!(matches!(error, InstallError::Cancelled));
        assert!(!assets.is_installed(&component));

        let _ = fs::remove_dir_all(folder);
    }

    #[test]
    fn imports_files_by_their_hash_whatever_they_are_called() {
        let folder = scratch("import");
        let assets = VoiceAssets::new(folder.join("voice"));
        let component = voice("https://unused", "/ok", None);
        let renamed = folder.join("downloaded (1).bin");
        let stranger = folder.join("other.bin");

        fs::write(&renamed, BODY).unwrap();
        fs::write(&stranger, b"something else").unwrap();

        assert!(matches!(
            assets.import_files(&component, std::slice::from_ref(&stranger)),
            Err(InstallError::NotInCatalog(_))
        ));
        assert!(matches!(
            assets.import_files(&component, &[]),
            Err(InstallError::Missing(_))
        ));

        assets.import_files(&component, &[renamed]).unwrap();

        assert!(assets.is_installed(&component));

        let _ = fs::remove_dir_all(folder);
    }

    #[test]
    fn marks_an_install_from_other_hashes_outdated() {
        let folder = scratch("outdated");
        let assets = VoiceAssets::new(&folder);
        let mut component = voice("https://unused", "/ok", None);
        let original = folder.join("model.bin");

        fs::write(&original, BODY).unwrap();
        assets.import_files(&component, &[original]).unwrap();
        component.files[0].sha256 = sha_of(b"a newer model");

        assert!(!assets.is_installed(&component));
        assert!(assets.is_outdated(&component));

        let _ = fs::remove_dir_all(folder);
    }

    #[test]
    fn imports_a_custom_voice_only_with_its_config() {
        let folder = scratch("custom");
        let assets = VoiceAssets::new(folder.join("voice"));
        let model = folder.join("my-voice.onnx");

        fs::write(&model, b"onnx").unwrap();

        assert!(matches!(
            assets.import_custom_voice(&model),
            Err(InstallError::NotAVoice(_))
        ));

        fs::write(
            folder.join("my-voice.onnx.json"),
            r#"{ "audio": { "sample_rate": 22050 } }"#,
        )
        .unwrap();

        let voice = assets.import_custom_voice(&model).unwrap();

        assert_eq!(voice.name, "my-voice");

        let cyrillic = folder.join("голос 2.onnx");

        fs::write(&cyrillic, b"onnx").unwrap();
        fs::write(
            folder.join("голос 2.onnx.json"),
            r#"{ "audio": { "sample_rate": 22050 } }"#,
        )
        .unwrap();

        assert_eq!(
            assets.import_custom_voice(&cyrillic).unwrap().name,
            "______2"
        );
        fs::remove_dir_all(folder.join("voice/custom-voices/______2")).unwrap();
        assert_eq!(assets.custom_voices(), vec![voice]);

        let _ = fs::remove_dir_all(folder);
    }

    #[test]
    fn imports_every_voice_of_a_folder_and_removes_one() {
        let folder = scratch("custom-folder");
        let assets = VoiceAssets::new(folder.join("voice"));
        let source = folder.join("download");
        let nested = source.join("en").join("en_GB").join("alan").join("low");
        let config = r#"{ "audio": { "sample_rate": 16000 } }"#;

        fs::create_dir_all(&nested).unwrap();
        fs::write(source.join("first.onnx"), b"onnx").unwrap();
        fs::write(source.join("first.onnx.json"), config).unwrap();
        fs::write(nested.join("alan.onnx"), b"onnx").unwrap();
        fs::write(nested.join("alan.onnx.json"), config).unwrap();
        fs::write(source.join("not-a-voice.onnx"), b"onnx").unwrap();

        let names: Vec<String> = assets
            .import_custom_voice_folder(&source)
            .unwrap()
            .into_iter()
            .map(|voice| voice.name)
            .collect();

        assert_eq!(names, vec!["alan", "first"]);

        assets.remove_custom_voice("alan").unwrap();

        assert_eq!(
            assets
                .custom_voices()
                .into_iter()
                .map(|voice| voice.name)
                .collect::<Vec<_>>(),
            vec!["first"]
        );
        assert!(assets.remove_custom_voice("..").is_err());
        assert!(assets.remove_custom_voice("a/b").is_err());

        let empty = folder.join("empty");

        fs::create_dir_all(&empty).unwrap();
        assert!(matches!(
            assets.import_custom_voice_folder(&empty),
            Err(InstallError::NotAVoice(_))
        ));

        let _ = fs::remove_dir_all(folder);
    }

    #[test]
    fn finds_no_engine_until_it_is_installed() {
        let folder = scratch("engines");
        let assets = VoiceAssets::new(&folder);

        fs::create_dir_all(folder.join(PIPER_ENGINE)).unwrap();
        fs::write(folder.join(PIPER_ENGINE).join(PIPER_EXECUTABLE), b"exe").unwrap();

        assert_eq!(assets.piper_executable(), None);
        assert_eq!(assets.vosk_library(), None);
        assert_eq!(assets.vosk_model("ru"), None);

        let _ = fs::remove_dir_all(folder);
    }
}
