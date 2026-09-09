import type {
  ApiEnvelope,
  AuthTokensResponse,
  CourseResponse,
  LessonResponse,
  LessonTranscriptResponse,
  ReplaceLessonTranscriptInput,
  LessonNoteResponse,
  NotificationPayload,
  UpdateLessonProgressInput,
  CreateLessonNoteInput,
  UpdateLessonNoteInput,
  QuizRunResponse,
  QuizReviewResponse,
  QuizReviewQuestionResponse,
  CourseQuizReviewResponse,
  QuizQuestionPayload,
  SessionResponse,
  SessionStatePayload,
  UserRole,
  ChatMessagePayload,
} from './index';
import { API_ERROR_CODES } from './index';

const role: UserRole = 'STUDENT';

const authResponse: AuthTokensResponse = {
  accessToken: 'access',
  refreshToken: 'refresh',
  user: {
    id: 'user-1',
    email: 'student@example.com',
    name: 'Student',
    role,
  },
};

const course: CourseResponse = {
  id: 'course-1',
  title: 'Realtime LMS',
  slug: 'realtime-lms',
  description: null,
  status: 'DRAFT',
  instructorId: 'user-1',
  publishedAt: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const lesson: LessonResponse = {
  id: 'lesson-1',
  courseId: course.id,
  title: 'Intro',
  description: null,
  order: 1,
  durationSeconds: 600,
  mediaAssetId: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const lessonTranscript: LessonTranscriptResponse = {
  lessonId: lesson.id,
  cues: [
    {
      id: 'cue-1',
      lessonId: lesson.id,
      startSeconds: 0,
      endSeconds: 10,
      text: 'Welcome to the lesson',
      order: 1,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
  ],
};

const replaceLessonTranscript: ReplaceLessonTranscriptInput = {
  cues: [
    {
      startSeconds: 0,
      endSeconds: 10,
      text: 'Welcome to the lesson',
    },
  ],
};

const lessonNote: LessonNoteResponse = {
  id: 'note-1',
  userId: 'user-1',
  lessonId: lesson.id,
  body: 'Review this section',
  positionSeconds: 42,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const createLessonNote: CreateLessonNoteInput = {
  body: lessonNote.body,
  positionSeconds: lessonNote.positionSeconds,
};

const updateLessonNote: UpdateLessonNoteInput = {
  body: 'Updated note',
  positionSeconds: null,
};

const updateLessonProgress: UpdateLessonProgressInput = {
  positionSeconds: 120,
  completed: true,
};

const session: SessionResponse = {
  id: 'session-1',
  courseId: course.id,
  title: 'Live class',
  startsAt: new Date(0).toISOString(),
  endsAt: null,
  status: 'SCHEDULED',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const quizRun: QuizRunResponse = {
  id: 'quiz-run-1',
  quizId: 'quiz-1',
  sessionId: session.id,
  currentQuestionIndex: null,
  status: 'PENDING',
  questionOpenedAt: null,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
};

const quizReviewQuestion: QuizReviewQuestionResponse = {
  questionId: 'question-1',
  text: 'Which store is relational?',
  options: [{ id: 'a', text: 'PostgreSQL' }],
  correctOptionId: 'a',
  selectedOptionId: 'a',
  isCorrect: true,
  score: 1,
  explanation: 'PostgreSQL is a relational database.',
  order: 1,
};

const quizReview: QuizReviewResponse = {
  quizRunId: quizRun.id,
  quizId: quizRun.quizId,
  quizTitle: 'Check your understanding',
  lessonId: lesson.id,
  lessonTitle: lesson.title,
  status: 'FINISHED',
  startedAt: new Date(0).toISOString(),
  finishedAt: new Date(0).toISOString(),
  totalScore: 1,
  questionCount: 1,
  correctCount: 1,
  questions: [quizReviewQuestion],
};

const courseQuizReview: CourseQuizReviewResponse = {
  courseId: course.id,
  reviews: [quizReview],
};

const envelope: ApiEnvelope<AuthTokensResponse> = {
  success: true,
  data: authResponse,
  error: null,
  meta: null,
};

const authErrorCode = API_ERROR_CODES.AUTH_INVALID_CREDENTIALS;

const sessionState: SessionStatePayload = {
  id: session.id,
  status: 'LIVE',
  participantCount: 1,
};

const chatMessage: ChatMessagePayload = {
  id: 'message-1',
  sessionId: session.id,
  userId: 'user-1',
  name: 'Student',
  content: 'Hello',
  createdAt: new Date(0).toISOString(),
};

const quizQuestion: QuizQuestionPayload = {
  currentQuestionIndex: 1,
  question: {
    id: 'question-1',
    text: 'Which store is relational?',
    options: [{ id: 'a', text: 'PostgreSQL' }],
  },
};

const notification: NotificationPayload = {
  id: 'notification-1',
  type: 'COURSE_PUBLISHED',
  title: 'Course published',
  body: 'Realtime LMS Foundations is live',
  createdAt: new Date(0).toISOString(),
};

void lesson;
void lessonTranscript;
void replaceLessonTranscript;
void lessonNote;
void createLessonNote;
void updateLessonNote;
void updateLessonProgress;
void quizRun;
void quizReviewQuestion;
void quizReview;
void courseQuizReview;
void envelope;
void authErrorCode;
void sessionState;
void chatMessage;
void quizQuestion;
void notification;
