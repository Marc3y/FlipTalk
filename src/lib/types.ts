export type RoomPhase =
  | "lobby" // waiting for the host to pick
  | "recording" // picked viewer is recording
  | "guessing" // clip uploaded, streamer listens to it reversed and imitates
  | "reveal" // streamer's attempt re-reversed and compared
  | "closed";

export interface PublicPlayer {
  id: string;
  name: string;
  image: string | null;
}

export type Verdict = "nailed" | "failed";

export interface RoomState {
  code: string;
  host: PublicPlayer;
  phase: RoomPhase;
  /** Monotonic counter; clients drop any state older than what they have. */
  version: number;
  round: number;
  picked: PublicPlayer | null;
  pickedAt: number | null;
  /** Set once the picked viewer uploaded a clip. */
  clipId: string | null;
  lastResult: { player: PublicPlayer; verdict: Verdict; round: number } | null;
  playerCount: number;
  updatedAt: number;
}

export interface MeState {
  user: PublicPlayer | null;
  isHost: boolean;
  joined: boolean;
  banned: boolean;
}
