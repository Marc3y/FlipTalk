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
  /** Lobby closed to newcomers; people already in it keep playing. Missing on rooms created before this existed. */
  locked?: boolean;
  /** Slots in the room (1–50). Missing on rooms created before this existed: treat as the default. */
  maxPlayers?: number;
  picked: PublicPlayer | null;
  pickedAt: number | null;
  /** Set once the picked viewer uploaded a clip. */
  clipId: string | null;
  lastResult: { player: PublicPlayer; verdict: Verdict; round: number } | null;
  /** Waiting to be picked right now. */
  playerCount: number;
  /** Holding a slot: in the lobby, on their turn, or done and able to play again. */
  memberCount: number;
  updatedAt: number;
}

export interface MeState {
  user: PublicPlayer | null;
  isHost: boolean;
  joined: boolean;
  /** Holds one of the room's slots (stays true after their turn, until they leave or are banned). */
  member: boolean;
  banned: boolean;
}
