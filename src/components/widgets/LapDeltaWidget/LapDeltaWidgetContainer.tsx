import { useEffect, useMemo, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';

import { telemetryStore } from '../../../store/iracing';
import type { Sector } from '../../../types/bindings';
import { formatDelta, getDeltaState } from './lap-delta-utils';
import { LapDeltaWidget } from './LapDeltaWidget';

const filterSectors = (raw: Sector[] | null | undefined): Sector[] =>
  (raw ?? [])
    .filter((s) => s.SectorStartPct != null && s.SectorNum != null)
    .sort((a, b) => (a.SectorStartPct ?? 0) - (b.SectorStartPct ?? 0));

export const LapDeltaWidgetContainer = observer(() => {
  const lap = telemetryStore.lapTiming;
  const driverInfo = telemetryStore.driverInfo;
  const carIdx = telemetryStore.carIdx;
  const session = telemetryStore.session;
  const sessionInfo = telemetryStore.sessionInfo;
  const sessions = sessionInfo?.SessionInfo?.Sessions ?? [];
  const sessionNum = session?.session_num ?? null;

  const current = lap?.lap_current_lap_time ?? null;
  const best = lap?.lap_best_lap_time ?? null;
  const hasDelta = current !== null && best !== null && best > 0;
  const delta = hasDelta ? current - best : null;

  const playerCarIdx = driverInfo?.DriverCarIdx ?? null;
  const currentLap =
    playerCarIdx !== null ? (carIdx?.car_idx_lap[playerCarIdx] ?? null) : null;
  const totalLaps =
    sessionNum !== null ? (sessions[sessionNum]?.SessionLaps ?? null) : null;

  const rawSectors = sessionInfo?.SplitTimeInfo?.Sectors;

  const sectors = useMemo(() => filterSectors(rawSectors), [rawSectors]);

  const [sectorTimes, setSectorTimes] = useState<(number | null)[]>(() =>
    Array.from<number | null>({ length: sectors.length }).fill(null)
  );

  const lastSectorIdxRef = useRef(-1);
  const sectorEntryTimeRef = useRef(-1);
  const lastLapRef = useRef(-1);

  useEffect(() => {
    setSectorTimes(
      Array.from<number | null>({ length: sectors.length }).fill(null)
    );
    lastSectorIdxRef.current = -1;
    sectorEntryTimeRef.current = -1;
    lastLapRef.current = -1;
  }, [sectors.length]);

  useEffect(() => {
    if (!lap || !session || sectors.length === 0) return;

    const lapDistPct = lap.lap_dist_pct ?? -1;
    const sessionTime = session.session_time ?? 0;
    const currentLapNum = lap.lap ?? 0;

    if (lapDistPct < 0) return;

    if (currentLapNum !== lastLapRef.current && lastLapRef.current >= 0) {
      lastSectorIdxRef.current = -1;
      sectorEntryTimeRef.current = -1;
      setSectorTimes(
        Array.from<number | null>({ length: sectors.length }).fill(null)
      );
    }
    lastLapRef.current = currentLapNum;

    let currentSectorIdx = 0;
    for (let i = sectors.length - 1; i >= 0; i--) {
      if ((sectors[i].SectorStartPct ?? 0) <= lapDistPct) {
        currentSectorIdx = i;
        break;
      }
    }

    if (currentSectorIdx !== lastSectorIdxRef.current) {
      if (lastSectorIdxRef.current >= 0 && sectorEntryTimeRef.current >= 0) {
        const elapsed = sessionTime - sectorEntryTimeRef.current;
        if (elapsed > 0 && elapsed < 600) {
          const prevIdx = lastSectorIdxRef.current;
          setSectorTimes((prev) => {
            const next = [...prev];
            next[prevIdx] = elapsed;
            return next;
          });
        }
      }
      lastSectorIdxRef.current = currentSectorIdx;
      sectorEntryTimeRef.current = sessionTime;
    }
  }, [lap, session, sectors]);

  const sectorDeltas: (number | null)[] = sectorTimes.map((t) => {
    if (t === null || best === null || best <= 0 || sectors.length === 0)
      return null;
    const sectorBest = best / sectors.length;
    return t - sectorBest;
  });

  return (
    <LapDeltaWidget
      deltaFormatted={formatDelta(delta)}
      deltaState={getDeltaState(delta)}
      currentLap={currentLap}
      totalLaps={totalLaps}
      sectorDeltas={sectorDeltas}
    />
  );
});
