import type {
  ApiEnvelope,
  AuthTokensResponse,
  CourseResponse,
  LessonResponse,
  NotificationPayload,
  QuizRunResponse,
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
void quizRun;
void envelope;
void authErrorCode;
void sessionState;
void chatMessage;
void quizQuestion;
void notification;
