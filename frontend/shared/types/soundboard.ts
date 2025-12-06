export interface SoundboardSound {
  id: number
  name: string
  fileUrl: string
  fileName: string
  durationMs: number
  fileSize: number
  userId: number
  username: string
  createdAt: Date
}

export interface SoundboardPlayEvent {
  type: 'SOUND_PLAYED'
  soundId: number
  userId: string
}

export interface SoundboardAddEvent {
  type: 'SOUND_ADDED'
  sound: SoundboardSound
}

export type SoundboardEvent = SoundboardPlayEvent | SoundboardAddEvent
