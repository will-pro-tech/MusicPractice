export type Role = "child" | "parent";

export interface User {
  id: string;
  role: Role;
  displayName: string;
  username: string;
  familyName: string;
}

export interface Child {
  id: string;
  name: string;
  instrument: string;
  color: string;
  sortOrder: number;
  inviteCode: string | null;
  joined: boolean;
  username: string | null;
}

/** The logged-in child's own profile. */
export interface MyChild {
  id: string;
  name: string;
  instrument: string;
  color: string;
}

export interface InvitePreview {
  name: string;
  familyName: string;
  role: Role;
}

export interface Adult {
  id: string;
  displayName: string;
  username: string;
  isSelf: boolean;
}

export interface ParentInvite {
  code: string;
  displayName: string;
}

export interface Session {
  id: string;
  childId: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM
  exercisesNote: string;
  exercisesDone: boolean;
  churchSong: string;
  churchDone: boolean;
  newSong: string;
  newSongGoal: string;
  newSongGoalMet: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChildSummary {
  child: Child;
  daysPracticed: number;
  sessions: Session[];
}

export interface Summary {
  days: number;
  children: ChildSummary[];
}

export interface Song {
  id: string;
  title: string;
  tags: string[];
  notes: string;
  createdAt: string;
}

export interface ServiceSong {
  id: string;
  songId: string | null;
  title: string;
  tags: string[];
}

export interface Service {
  id: string;
  date: string;
  theme: string;
  notes: string;
  createdAt: string;
  songs: ServiceSong[];
}

export interface SundaySongs {
  service: { date: string; theme: string } | null;
  songs: ServiceSong[];
}
