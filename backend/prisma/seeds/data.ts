import type { Prisma } from '../../src/generated/prisma/client';

export const seedPassword = 'Password123!';

export const seedUsers = {
  admin: {
    email: 'admin@example.com',
    name: 'Admin',
    role: 'ADMIN',
  },
  instructor: {
    email: 'instructor@example.com',
    name: 'Instructor',
    role: 'INSTRUCTOR',
  },
  student: {
    email: 'student@example.com',
    name: 'Student',
    role: 'STUDENT',
  },
  studentTwo: {
    email: 'student2@example.com',
    name: 'Student Two',
    role: 'STUDENT',
  },
} as const;

export const seedCourse = {
  title: 'Realtime LMS Foundations',
  slug: 'realtime-lms-foundations',
  description: 'Seed course for local realtime LMS testing',
  status: 'PUBLISHED',
} as const;

export const seedLessons = {
  intro: {
    title: 'Intro lesson',
    description: 'First seed lesson',
    order: 1,
    durationSeconds: 600,
    media: {
      key: 'videos/seed-demo-intro.mp4',
      fileName: 'seed-demo-intro.mp4',
      contentType: 'video/mp4',
      sizeBytes: BigInt(5_000_000),
    },
  },
  realtimeRoom: {
    title: 'Realtime room basics',
    description: 'Joining sessions and receiving live updates',
    order: 2,
    durationSeconds: 900,
    media: {
      key: 'videos/seed-demo-realtime-room.mp4',
      fileName: 'seed-demo-realtime-room.mp4',
      contentType: 'video/mp4',
      sizeBytes: BigInt(8_200_000),
    },
  },
  quiz: {
    title: 'Quiz orchestration',
    description: 'Instructor-led quiz runs and answer scoring',
    order: 3,
    durationSeconds: 720,
    media: {
      key: 'videos/seed-demo-quiz.mp4',
      fileName: 'seed-demo-quiz.mp4',
      contentType: 'video/mp4',
      sizeBytes: BigInt(6_400_000),
    },
  },
  progress: {
    title: 'Progress heartbeat flow',
    description: 'Student playback heartbeats and instructor dashboards',
    order: 4,
    durationSeconds: 840,
    media: {
      key: 'videos/seed-demo-progress.mp4',
      fileName: 'seed-demo-progress.mp4',
      contentType: 'video/mp4',
      sizeBytes: BigInt(7_100_000),
    },
  },
} as const;

export const seedSession = {
  title: 'Live intro session',
  startsInHours: 24,
  status: 'LIVE',
} as const;

export const seedQuestions = [
  {
    text: 'Which service stores relational LMS data?',
    options: [
      { id: 'a', text: 'PostgreSQL' },
      { id: 'b', text: 'Redis' },
    ] as Prisma.InputJsonValue,
    correctOptionId: 'a',
    order: 1,
  },
  {
    text: 'Which protocol powers realtime events here?',
    options: [
      { id: 'a', text: 'Socket.IO' },
      { id: 'b', text: 'SMTP' },
    ] as Prisma.InputJsonValue,
    correctOptionId: 'a',
    order: 2,
  },
  {
    text: 'Which service backs BullMQ?',
    options: [
      { id: 'a', text: 'Redis' },
      { id: 'b', text: 'MinIO' },
    ] as Prisma.InputJsonValue,
    correctOptionId: 'a',
    order: 3,
  },
  {
    text: 'Which room prefix is used for quiz runs?',
    options: [
      { id: 'a', text: 'quiz-run:' },
      { id: 'b', text: 'course:' },
    ] as Prisma.InputJsonValue,
    correctOptionId: 'a',
    order: 4,
  },
  {
    text: 'Should quiz:question expose correctOptionId?',
    options: [
      { id: 'a', text: 'No' },
      { id: 'b', text: 'Yes' },
    ] as Prisma.InputJsonValue,
    correctOptionId: 'a',
    order: 5,
  },
];
