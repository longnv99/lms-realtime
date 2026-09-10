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

export const seedTranscriptCues = [
  {
    lessonOrder: 1,
    cues: [
      { startSeconds: 0, endSeconds: 20, text: 'Welcome to the realtime LMS foundations course.' },
      {
        startSeconds: 20,
        endSeconds: 55,
        text: 'This lesson introduces the learner, instructor, and admin workflows.',
      },
      {
        startSeconds: 55,
        endSeconds: 95,
        text: 'By the end, you will understand how course sessions connect with progress tracking.',
      },
    ],
  },
  {
    lessonOrder: 2,
    cues: [
      { startSeconds: 0, endSeconds: 30, text: 'Welcome to realtime room basics.' },
      {
        startSeconds: 30,
        endSeconds: 90,
        text: 'Learners join a live session and receive instructor updates in realtime.',
      },
      {
        startSeconds: 90,
        endSeconds: 150,
        text: 'Presence, chat, and session status updates keep everyone aligned during class.',
      },
    ],
  },
  {
    lessonOrder: 3,
    cues: [
      { startSeconds: 0, endSeconds: 25, text: 'Welcome to quiz orchestration.' },
      {
        startSeconds: 25,
        endSeconds: 85,
        text: 'Instructors open questions, collect answers, and reveal results during live sessions.',
      },
      {
        startSeconds: 85,
        endSeconds: 145,
        text: 'Learners can review their answers after the quiz run has finished.',
      },
    ],
  },
  {
    lessonOrder: 4,
    cues: [
      { startSeconds: 0, endSeconds: 30, text: 'Welcome to the progress heartbeat flow.' },
      {
        startSeconds: 30,
        endSeconds: 95,
        text: 'Playback heartbeats save each learner position without interrupting the lesson.',
      },
      {
        startSeconds: 95,
        endSeconds: 160,
        text: 'Instructor dashboards use progress signals to understand course engagement.',
      },
    ],
  },
];

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
    explanation:
      'PostgreSQL stores relational LMS records such as users, courses, lessons, quizzes, and answers.',
    order: 1,
  },
  {
    text: 'Which protocol powers realtime events here?',
    options: [
      { id: 'a', text: 'Socket.IO' },
      { id: 'b', text: 'SMTP' },
    ] as Prisma.InputJsonValue,
    correctOptionId: 'a',
    explanation:
      'Socket.IO powers bidirectional realtime classroom events between the server and connected clients.',
    order: 2,
  },
  {
    text: 'Which service backs BullMQ?',
    options: [
      { id: 'a', text: 'Redis' },
      { id: 'b', text: 'MinIO' },
    ] as Prisma.InputJsonValue,
    correctOptionId: 'a',
    explanation:
      'Redis backs BullMQ queues and also supports fast realtime counters and leaderboard state.',
    order: 3,
  },
  {
    text: 'Which room prefix is used for quiz runs?',
    options: [
      { id: 'a', text: 'quiz-run:' },
      { id: 'b', text: 'course:' },
    ] as Prisma.InputJsonValue,
    correctOptionId: 'a',
    explanation:
      'The quiz-run: prefix scopes realtime rooms and cache keys to one active quiz run.',
    order: 4,
  },
  {
    text: 'Should quiz:question expose correctOptionId?',
    options: [
      { id: 'a', text: 'No' },
      { id: 'b', text: 'Yes' },
    ] as Prisma.InputJsonValue,
    correctOptionId: 'a',
    explanation:
      'Live question events hide correctOptionId so learners cannot see the answer before reveal or review.',
    order: 5,
  },
];
