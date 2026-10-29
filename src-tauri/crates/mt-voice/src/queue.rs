//! Who speaks next. One voice at a time: a reply waits for the one before it
//! to finish, in the order they were asked, and a reply that is no longer true
//! by the time its turn comes is dropped. Nobody speaks over the driver.

use std::time::{Duration, Instant};

#[derive(Debug, Clone, PartialEq)]
pub struct Reply<T> {
    pub queued_at: Instant,
    /// How long the reply stays true; past it, it is dropped unspoken.
    pub ttl: Duration,
    pub content: T,
}

impl<T> Reply<T> {
    fn expired(&self, now: Instant) -> bool {
        now.duration_since(self.queued_at) > self.ttl
    }
}

#[derive(Debug)]
pub struct ReplyQueue<T> {
    waiting: Vec<Reply<T>>,
}

impl<T> Default for ReplyQueue<T> {
    fn default() -> Self {
        Self {
            waiting: Vec::new(),
        }
    }
}

impl<T> ReplyQueue<T> {
    pub fn push(&mut self, reply: Reply<T>) {
        self.waiting.push(reply);
    }

    pub fn len(&self) -> usize {
        self.waiting.len()
    }

    pub fn is_empty(&self) -> bool {
        self.waiting.is_empty()
    }

    pub fn clear(&mut self) {
        self.waiting.clear();
    }

    /// The reply to speak now, if any may start: expired ones are dropped
    /// first, then the oldest goes — unless the driver holds push-to-talk.
    pub fn next(&mut self, now: Instant, ptt_held: bool) -> Option<Reply<T>> {
        self.waiting.retain(|reply| !reply.expired(now));

        if ptt_held {
            return None;
        }

        let index = self
            .waiting
            .iter()
            .enumerate()
            .min_by_key(|(_, reply)| reply.queued_at)
            .map(|(index, _)| index)?;

        Some(self.waiting.remove(index))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const LONG: Duration = Duration::from_secs(30);

    fn reply(queued_at: Instant, content: &'static str) -> Reply<&'static str> {
        Reply {
            queued_at,
            ttl: LONG,
            content,
        }
    }

    fn next(
        queue: &mut ReplyQueue<&'static str>,
        now: Instant,
        ptt_held: bool,
    ) -> Option<&'static str> {
        queue.next(now, ptt_held).map(|reply| reply.content)
    }

    #[test]
    fn speaks_in_the_order_asked() {
        let start = Instant::now();
        let mut queue = ReplyQueue::default();

        queue.push(reply(start + Duration::from_millis(5), "second"));
        queue.push(reply(start, "first"));

        assert_eq!(next(&mut queue, start + LONG / 2, false), Some("first"));
        assert_eq!(next(&mut queue, start + LONG / 2, false), Some("second"));
        assert_eq!(next(&mut queue, start + LONG / 2, false), None);
    }

    #[test]
    fn drops_a_reply_past_its_ttl() {
        let start = Instant::now();
        let mut queue = ReplyQueue::default();

        queue.push(Reply {
            ttl: Duration::from_secs(3),
            ..reply(start, "gap 1.2")
        });

        assert_eq!(
            next(&mut queue, start + Duration::from_secs(4), false),
            None
        );
        assert!(queue.is_empty());
    }

    #[test]
    fn nobody_speaks_while_the_driver_holds_ptt() {
        let start = Instant::now();
        let mut queue = ReplyQueue::default();

        queue.push(reply(start, "copy"));

        assert_eq!(next(&mut queue, start, true), None);
        assert_eq!(next(&mut queue, start, false), Some("copy"));
    }
}
