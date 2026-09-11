# LMS Realtime P8 Content & Media Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real instructor/admin media management workflow: media ownership, media library, attach/replace/detach lesson videos, delete unused assets, and lesson-level playback authorization.

**Architecture:** Keep MinIO presigned upload/playback as the storage boundary. Add media ownership in Prisma so instructor libraries can be scoped without exposing other instructors' uploads. Keep lesson video assignment in the Lessons module, while the Media module owns upload/list/delete/playback and checks attached lesson access for students.

**Tech Stack:** NestJS, Prisma, MinIO/S3, React, Vite, TypeScript, TanStack Query, shadcn-style dark UI, Vitest, Jest e2e, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-26-lms-realtime-design.md`

## Global Constraints

- Do not clear or reset local/production data unless a task explicitly says to run the reset seed command.
- Frontend visible copy must be English.
- UI must use the existing shadcn-style dark theme and `frontend/src/components/ui/*` as the base component layer.
- For UI/layout changes, run Playwright visual audit screenshots across desktop and mobile before handoff.
- Keep WebRTC/RTMP, HLS transcoding, resumable multipart upload, OAuth, and multi-tenant logic out of scope.
- After each implementation task that touches code, run the listed typecheck/build command before committing.

---

## File Structure

**Shared contracts**
- Modify `shared/src/media.ts` with media asset list/delete contracts.
- Modify `shared/src/lessons.ts` only if lesson media assignment needs a typed request/response shape.
- Modify `shared/src/contracts.type-test.ts` to compile-check new contracts.

**Backend**
- Modify `backend/prisma/models/media.prisma` and `backend/prisma/models/user.prisma` for `MediaAsset.uploadedById`.
- Create Prisma migration `backend/prisma/migrations/<timestamp>_p8_media_ownership/migration.sql`.
- Modify `backend/src/media/media.controller.ts` and `backend/src/media/media.service.ts`.
- Modify `backend/src/media/s3-storage.service.ts` to delete unused objects.
- Create `backend/src/media/dto/list-media-assets-query.dto.ts`.
- Modify `backend/src/modules/lessons/dto/update-lesson.dto.ts` or create `backend/src/modules/lessons/dto/update-lesson-media.dto.ts`.
- Modify `backend/src/modules/lessons/lessons.controller.ts` and `backend/src/modules/lessons/lessons.service.ts`.
- Modify `backend/prisma/seeds/lessons.seed.ts` so seeded media has a stable owner.
- Modify backend e2e tests in `backend/test/media.e2e-spec.ts` and `backend/test/lessons.e2e-spec.ts`.

**Frontend**
- Modify `frontend/src/api/media.ts` and `frontend/src/api/lessons.ts`.
- Create `frontend/src/features/media/MediaLibraryPanel.tsx`.
- Create `frontend/src/features/media/MediaLibraryPanel.test.tsx`.
- Modify `frontend/src/features/lessons/LessonMediaUpload.tsx`.
- Modify `frontend/src/features/lessons/LessonsPanel.tsx` and `frontend/src/features/lessons/LessonsPanel.test.tsx`.
- Modify `frontend/src/styles/global.css` for library drawer/picker states.
- Modify `tests/e2e/p6-learning-ux.spec.ts` or create `tests/e2e/p8-media-management.spec.ts` for the instructor upload/attach smoke path.

**Docs**
- Modify `README.md` with P8 manual smoke instructions.
- Modify this plan file as tasks complete.

---

### Task 1: Shared Media Contracts And API Helpers

**Files:**
- Modify: `shared/src/media.ts`
- Modify: `shared/src/contracts.type-test.ts`
- Modify: `frontend/src/api/media.ts`
- Modify: `frontend/src/api/client.test.ts`

**Interfaces:**
- Consumes:
  - existing `CreateMediaUploadResponse`
  - existing `MediaPlaybackResponse`
- Produces:
  - `MediaAssetStatus = 'PENDING' | 'UPLOADED'`
  - `MediaAssetListItemResponse`
  - `ListMediaAssetsQuery`
  - `ListMediaAssetsResponse`
  - `DeletedMediaAssetResponse`
  - `listMediaAssets(query?: ListMediaAssetsQuery)`
  - `deleteMediaAsset(assetId: string)`

- [x] **Step 1: Write failing shared contract test**

Add this shape to `shared/src/contracts.type-test.ts`:

```ts
const mediaAsset: MediaAssetListItemResponse = {
  contentType: 'video/mp4',
  createdAt: '2026-09-11T00:00:00.000Z',
  fileName: 'intro.mp4',
  id: 'asset-1',
  key: 'videos/asset-1.mp4',
  lesson: {
    courseId: lesson.courseId,
    courseTitle: 'Realtime LMS Foundations',
    id: lesson.id,
    title: lesson.title,
  },
  sizeBytes: 1024,
  status: 'UPLOADED',
  updatedAt: '2026-09-11T00:00:00.000Z',
  uploadedBy: {
    email: 'instructor@example.com',
    id: 'user-1',
    name: 'Instructor',
  },
};

const mediaAssets: ListMediaAssetsResponse = {
  items: [mediaAsset],
  page: 1,
  limit: 20,
  total: 1,
};

void mediaAssets;
```

Run:

```bash
npm run typecheck:shared
```

Expected: FAIL because the new media list types do not exist.

- [x] **Step 2: Add shared media contracts**

In `shared/src/media.ts`, add:

```ts
export type MediaAssetStatus = 'PENDING' | 'UPLOADED';

export interface MediaAssetOwnerResponse {
  id: string;
  email: string;
  name: string;
}

export interface MediaAssetLessonResponse {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
}

export interface MediaAssetListItemResponse {
  id: string;
  key: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: MediaAssetStatus;
  uploadedBy: MediaAssetOwnerResponse | null;
  lesson: MediaAssetLessonResponse | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListMediaAssetsQuery {
  attached?: boolean;
  page?: number;
  limit?: number;
  q?: string;
  status?: MediaAssetStatus;
}

export interface ListMediaAssetsResponse {
  items: MediaAssetListItemResponse[];
  page: number;
  limit: number;
  total: number;
}

export interface DeletedMediaAssetResponse {
  deleted: true;
}
```

- [x] **Step 3: Add frontend API helpers**

In `frontend/src/api/media.ts`, import the new shared types and add:

```ts
export async function listMediaAssets(
  query?: ListMediaAssetsQuery,
): Promise<ListMediaAssetsResponse> {
  return getEnvelope<ListMediaAssetsResponse>('/media/assets', query);
}

export async function deleteMediaAsset(assetId: string): Promise<DeletedMediaAssetResponse> {
  return deleteEnvelope<DeletedMediaAssetResponse>(`/media/assets/${assetId}`);
}
```

Update `frontend/src/api/client.test.ts` to assert:

```ts
expect(getSpy).toHaveBeenCalledWith('/media/assets', { attached: false, q: 'intro' });
expect(deleteSpy).toHaveBeenCalledWith('/media/assets/asset-1');
```

- [x] **Step 4: Verify**

Run:

```bash
npm run test --workspace=frontend -- client.test.ts
npm run typecheck:shared
npm run typecheck:frontend
npm run build:frontend
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add shared/src/media.ts shared/src/contracts.type-test.ts frontend/src/api/media.ts frontend/src/api/client.test.ts
git commit -m "feat(shared): add media library contracts"
```

---

### Task 2: Backend Media Ownership, Library Listing, And Delete

**Files:**
- Modify: `backend/prisma/models/media.prisma`
- Modify: `backend/prisma/models/user.prisma`
- Create: `backend/prisma/migrations/<timestamp>_p8_media_ownership/migration.sql`
- Create: `backend/src/media/dto/list-media-assets-query.dto.ts`
- Modify: `backend/src/media/media.controller.ts`
- Modify: `backend/src/media/media.service.ts`
- Modify: `backend/src/media/s3-storage.service.ts`
- Modify: `backend/prisma/seeds/lessons.seed.ts`
- Modify: `backend/test/media.e2e-spec.ts`

**Interfaces:**
- Consumes:
  - `MediaAssetListItemResponse`
  - `ListMediaAssetsQuery`
  - existing `S3StorageService`
- Produces:
  - `MediaAsset.uploadedById`
  - `GET /api/media/assets`
  - `DELETE /api/media/assets/:id`
  - `S3StorageService.deleteObject(key: string): Promise<void>`

- [x] **Step 1: Write failing backend e2e tests**

Add tests to `backend/test/media.e2e-spec.ts`:

```ts
it('lists only instructor-owned media plus attached course media for instructors', async () => {
  const owner = await registerAndLogin(app, 'INSTRUCTOR');
  const other = await registerAndLogin(app, 'INSTRUCTOR');
  const owned = await prisma.mediaAsset.create({
    data: {
      contentType: 'video/mp4',
      fileName: 'owned.mp4',
      key: 'videos/owned.mp4',
      sizeBytes: 1000,
      status: 'UPLOADED',
      uploadedById: owner.user.id,
    },
  });
  await prisma.mediaAsset.create({
    data: {
      contentType: 'video/mp4',
      fileName: 'other.mp4',
      key: 'videos/other.mp4',
      sizeBytes: 1000,
      status: 'UPLOADED',
      uploadedById: other.user.id,
    },
  });

  const res = await request(app.getHttpServer())
    .get('/api/media/assets')
    .set('Authorization', `Bearer ${owner.accessToken}`)
    .expect(200);

  expect(res.body.data.items.map((item: { id: string }) => item.id)).toEqual([owned.id]);
});

it('deletes only unused owned media assets and removes the object', async () => {
  const instructor = await registerAndLogin(app, 'INSTRUCTOR');
  const asset = await prisma.mediaAsset.create({
    data: {
      contentType: 'video/webm',
      fileName: 'unused.webm',
      key: 'videos/unused.webm',
      sizeBytes: 2000,
      status: 'UPLOADED',
      uploadedById: instructor.user.id,
    },
  });

  await request(app.getHttpServer())
    .delete(`/api/media/assets/${asset.id}`)
    .set('Authorization', `Bearer ${instructor.accessToken}`)
    .expect(200)
    .expect((res) => {
      expect(res.body.data).toEqual({ deleted: true });
    });

  expect(s3Storage.deleteObject).toHaveBeenCalledWith('videos/unused.webm');
});
```

Run:

```bash
npm run test:e2e --workspace=backend -- media.e2e-spec.ts
```

Expected: FAIL because `uploadedById`, list route, and delete route do not exist.

- [x] **Step 2: Add Prisma ownership**

Update `backend/prisma/models/media.prisma`:

```prisma
model MediaAsset {
  id           String           @id @default(uuid())
  key          String           @unique
  fileName     String
  contentType  String
  sizeBytes    BigInt
  status       MediaAssetStatus @default(PENDING)
  uploadedById String?
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  uploadedBy User?   @relation("UploadedMediaAssets", fields: [uploadedById], references: [id], onDelete: SetNull)
  lesson     Lesson?

  @@index([uploadedById])
  @@index([status])
}
```

Update `backend/prisma/models/user.prisma`:

```prisma
uploadedMediaAssets MediaAsset[] @relation("UploadedMediaAssets")
```

Create a migration:

```sql
ALTER TABLE "MediaAsset" ADD COLUMN "uploadedById" TEXT;
CREATE INDEX "MediaAsset_uploadedById_idx" ON "MediaAsset"("uploadedById");
CREATE INDEX "MediaAsset_status_idx" ON "MediaAsset"("status");
ALTER TABLE "MediaAsset"
  ADD CONSTRAINT "MediaAsset_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

- [x] **Step 3: Track upload owner**

Change controller signature:

```ts
createUpload(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUploadDto) {
  return this.mediaService.createUpload(user, dto);
}
```

Change service signature:

```ts
async createUpload(actor: AuthenticatedUser, dto: CreateUploadDto): Promise<CreateMediaUploadResponse>
```

Set `uploadedById: actor.id` when creating `MediaAsset`.

- [x] **Step 4: Implement list media assets**

Create `ListMediaAssetsQueryDto` with `attached`, `status`, `q`, `page`, and `limit`. In `MediaService.listAssets(actor, query)`, use:

```ts
const where: Prisma.MediaAssetWhereInput = {
  ...(actor.role === 'INSTRUCTOR' ? { uploadedById: actor.id } : {}),
  ...(query.status ? { status: query.status } : {}),
  ...(query.attached === true ? { lesson: { isNot: null } } : {}),
  ...(query.attached === false ? { lesson: { is: null } } : {}),
  ...(query.q
    ? {
        OR: [
          { fileName: { contains: query.q, mode: 'insensitive' } },
          { key: { contains: query.q, mode: 'insensitive' } },
        ],
      }
    : {}),
};
```

Return `{ items, page, limit, total }`, mapping `BigInt` `sizeBytes` to `number`.

- [x] **Step 5: Implement delete unused asset**

Add to `S3StorageService`:

```ts
async deleteObject(key: string): Promise<void> {
  await this.client.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}
```

In `MediaService.deleteAsset(actor, id)`:
- throw `NOT_FOUND` if missing;
- throw `AUTH_FORBIDDEN` if instructor does not own the asset;
- throw `MEDIA_ASSET_IN_USE` with HTTP 409 if `asset.lesson` exists;
- call `deleteObject(asset.key)`;
- delete the DB row;
- return `{ deleted: true }`.

- [x] **Step 6: Update seed media ownership**

In `backend/prisma/seeds/lessons.seed.ts`, set:

```ts
uploadedById: course.instructorId,
```

for create and update when upserting seeded media assets.

- [x] **Step 7: Verify**

Run:

```bash
npm run db:generate --workspace=backend
npm run test:e2e --workspace=backend -- media.e2e-spec.ts
npm run typecheck:backend
npm run build:backend
```

Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add backend/prisma backend/src/media backend/test/media.e2e-spec.ts
git commit -m "feat(backend): add instructor media library"
```

---

### Task 3: Lesson Media Attach/Detach And Playback Authorization

**Files:**
- Modify: `backend/src/modules/lessons/dto/update-lesson.dto.ts`
- Create: `backend/src/modules/lessons/dto/update-lesson-media.dto.ts`
- Modify: `backend/src/modules/lessons/lessons.controller.ts`
- Modify: `backend/src/modules/lessons/lessons.service.ts`
- Modify: `backend/src/media/media.controller.ts`
- Modify: `backend/src/media/media.service.ts`
- Modify: `backend/test/lessons.e2e-spec.ts`
- Modify: `backend/test/media.e2e-spec.ts`

**Interfaces:**
- Consumes:
  - `MediaAsset.uploadedById`
  - `CoursesService.ensureCanManage(course, actor)`
- Produces:
  - `PATCH /api/lessons/:id/media`
  - `UpdateLessonMediaDto { mediaAssetId: string | null }`
  - lesson-level authorization inside `GET /api/media/assets/:id/playback`

- [x] **Step 1: Write failing lesson attach/detach tests**

Add tests to `backend/test/lessons.e2e-spec.ts`:

```ts
it('attaches and detaches an uploaded media asset from an owned lesson', async () => {
  const instructor = await registerAndLogin(app, 'INSTRUCTOR');
  const course = await createCourse(instructor.accessToken);
  const lesson = await createLesson(instructor.accessToken, course.id, 'Media lesson');
  const asset = await prisma.mediaAsset.create({
    data: {
      contentType: 'video/mp4',
      fileName: 'media.mp4',
      key: 'videos/media.mp4',
      sizeBytes: 1000,
      status: 'UPLOADED',
      uploadedById: instructor.user.id,
    },
  });

  await request(app.getHttpServer())
    .patch(`/api/lessons/${lesson.id}/media`)
    .set('Authorization', `Bearer ${instructor.accessToken}`)
    .send({ mediaAssetId: asset.id })
    .expect(200)
    .expect((res) => {
      expect(res.body.data.mediaAssetId).toBe(asset.id);
    });

  await request(app.getHttpServer())
    .patch(`/api/lessons/${lesson.id}/media`)
    .set('Authorization', `Bearer ${instructor.accessToken}`)
    .send({ mediaAssetId: null })
    .expect(200)
    .expect((res) => {
      expect(res.body.data.mediaAssetId).toBeNull();
    });
});
```

Run:

```bash
npm run test:e2e --workspace=backend -- lessons.e2e-spec.ts
```

Expected: FAIL because `/lessons/:id/media` does not exist.

- [x] **Step 2: Implement dedicated lesson media DTO and endpoint**

Create:

```ts
export class UpdateLessonMediaDto {
  @IsOptional()
  @IsString()
  mediaAssetId!: string | null;
}
```

Add controller route:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
@Roles('ADMIN', 'INSTRUCTOR')
@Patch('lessons/:id/media')
updateMedia(
  @Param('id') id: string,
  @CurrentUser() user: AuthenticatedUser,
  @Body() dto: UpdateLessonMediaDto,
) {
  return this.lessonsService.updateMedia(id, user, dto);
}
```

Implement `updateMedia(id, actor, dto)` by loading lesson+course, checking manager permission, validating asset is `UPLOADED`, validating instructor owns the asset unless admin, then updating `mediaAssetId`.

- [x] **Step 3: Allow null media detach in validation**

Update `UpdateLessonDto` so normal lesson edits do not reject `mediaAssetId: null` if existing callers keep using `PATCH /lessons/:id`:

```ts
@IsOptional()
@IsString()
mediaAssetId?: string | null;
```

In service code, treat `undefined` as no media change and `null` as detach.

- [x] **Step 4: Write failing playback authorization tests**

Add to `backend/test/media.e2e-spec.ts`:

```ts
it('forbids playback when a student is not enrolled in the attached lesson course', async () => {
  const instructor = await registerAndLogin(app, 'INSTRUCTOR');
  const student = await registerAndLogin(app, 'STUDENT');
  const course = await createCourseForMediaTest(instructor.accessToken);
  const asset = await createUploadedAsset(instructor.user.id);
  await createLessonWithMedia(course.id, asset.id);

  await request(app.getHttpServer())
    .get(`/api/media/assets/${asset.id}/playback`)
    .set('Authorization', `Bearer ${student.accessToken}`)
    .expect(403)
    .expect((res) => {
      expect(res.body.error.code).toBe('AUTH_FORBIDDEN');
    });
});
```

Expected: FAIL because current playback allows any authenticated user.

- [x] **Step 5: Implement playback authorization**

Change controller signature:

```ts
createPlayback(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
  return this.mediaService.createPlayback(user, id);
}
```

In `MediaService.createPlayback(actor, id)`:
- load asset with attached `lesson.course.instructorId` and course enrollments for `actor.id`;
- allow admin;
- allow the course instructor;
- allow students only when the attached lesson belongs to a course they are enrolled in;
- deny unattached media playback to students;
- return current presigned playback response only after authorization.

- [x] **Step 6: Verify**

Run:

```bash
npm run test:e2e --workspace=backend -- lessons.e2e-spec.ts media.e2e-spec.ts
npm run typecheck:backend
npm run build:backend
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add backend/src/modules/lessons backend/src/media backend/test/lessons.e2e-spec.ts backend/test/media.e2e-spec.ts
git commit -m "feat(backend): authorize lesson media assignment"
```

---

### Task 4: Frontend Media Library And Lesson Media Picker

**Files:**
- Create: `frontend/src/features/media/MediaLibraryPanel.tsx`
- Create: `frontend/src/features/media/MediaLibraryPanel.test.tsx`
- Modify: `frontend/src/features/lessons/LessonMediaUpload.tsx`
- Modify: `frontend/src/features/lessons/LessonsPanel.tsx`
- Modify: `frontend/src/features/lessons/LessonsPanel.test.tsx`
- Modify: `frontend/src/api/lessons.ts`
- Modify: `frontend/src/styles/global.css`

**Interfaces:**
- Consumes:
  - `listMediaAssets`
  - `deleteMediaAsset`
  - `updateLesson`
  - existing upload flow
- Produces:
  - `MediaLibraryPanel`
  - instructor UI to upload, attach existing media, replace attached media, detach media, and delete unused media

- [x] **Step 1: Write failing media library component tests**

Create `frontend/src/features/media/MediaLibraryPanel.test.tsx` with assertions:

```tsx
expect(await screen.findByText('Media library')).toBeInTheDocument();
expect(screen.getByText('intro.mp4')).toBeInTheDocument();
expect(screen.getByRole('button', { name: /attach intro.mp4/i })).toBeInTheDocument();
expect(screen.getByRole('button', { name: /delete unused.webm/i })).toBeInTheDocument();
```

Also assert:
- attached media delete button is disabled;
- search calls `listMediaAssets({ q: 'intro' })`;
- attach calls `onAttach('asset-1')`;
- delete calls `deleteMediaAsset('asset-unused')` and invalidates `['media-assets']`.

Run:

```bash
npm run test --workspace=frontend -- MediaLibraryPanel.test.tsx
```

Expected: FAIL because `MediaLibraryPanel` does not exist.

- [x] **Step 2: Implement `MediaLibraryPanel`**

Build a compact dark panel:
- header title `Media library`;
- search input;
- filter buttons `All`, `Unused`, `Attached`;
- rows with file name, upload status, size, attached lesson title if present;
- icon-only attach/delete actions with tooltips;
- `EmptyState` for no assets;
- `LoadingBlock` for query loading;
- inline error banner for query/delete errors.

Use existing shadcn-style primitives and no visible instructional copy.

- [x] **Step 3: Upgrade lesson media control**

In `LessonMediaUpload.tsx`, keep direct upload but add:
- icon action to open library panel;
- `Replace video` tooltip when lesson already has `mediaAssetId`;
- detach action calling `updateLesson(lesson.id, { mediaAssetId: null })`;
- attach existing action from `MediaLibraryPanel` calling `updateLesson(lesson.id, { mediaAssetId })`.

Visible labels:
- `Video attached`
- `No video`
- `Upload pending`
- `Attach media`
- `Detach video`

- [x] **Step 4: Update lessons tests**

Extend `LessonsPanel.test.tsx`:

```ts
expect(screen.getByRole('button', { name: /open media library for intro lesson/i })).toBeInTheDocument();
await user.click(screen.getByRole('button', { name: /detach video for practice/i }));
expect(mockedUpdateLesson).toHaveBeenCalledWith('lesson-2', { mediaAssetId: null });
```

- [x] **Step 5: Run Playwright visual audit**

Start local BE/FE without clearing DB. Use an instructor login and capture:
- desktop course detail with lesson media controls;
- mobile course detail with lesson media controls;
- media library open state.

Store screenshots under `artifacts/ui-audit/p8-media-library-<timestamp>/`.

Pass criteria:
- no horizontal overflow;
- no button text overflow;
- icon actions have readable hover/focus target;
- lesson rows remain balanced at desktop and mobile.

- [x] **Step 6: Verify**

Run:

```bash
npm run test --workspace=frontend -- MediaLibraryPanel.test.tsx LessonsPanel.test.tsx
npm run typecheck:frontend
npm run build:frontend
```

Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add frontend/src/api frontend/src/features/media frontend/src/features/lessons frontend/src/styles/global.css
git commit -m "feat(frontend): add lesson media library"
```

---

### Task 5: P8 E2E, README, And Plan Closeout

**Files:**
- Create: `tests/e2e/p8-media-management.spec.ts`
- Modify: `tests/e2e/helpers/demo-data.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-09-11-lms-realtime-p8-content-media-management.md`

**Interfaces:**
- Consumes:
  - P8 backend media library routes
  - P8 frontend media library UI
- Produces:
  - repeatable instructor media management smoke coverage
  - documented manual P8 smoke path

- [x] **Step 1: Add Playwright E2E media management smoke**

Create `tests/e2e/p8-media-management.spec.ts`:

```ts
test('instructor manages lesson media from the course detail page', async ({ browser, request }) => {
  const instructor = await loginAs(request, 'instructor@example.com');
  const demo = await getDemoData(request, instructor);
  const page = await newAuthenticatedPage(browser, instructor, { height: 900, width: 1440 });

  await page.goto(`/courses/${demo.courseId}`, { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible();
  await expect(page.getByRole('button', { name: /open media library/i }).first()).toBeVisible();
  await page.getByRole('button', { name: /open media library/i }).first().click();
  await expect(page.getByRole('heading', { name: 'Media library' })).toBeVisible();

  await page.context().close();
});
```

- [x] **Step 2: Add backend authorization smoke to E2E or backend tests**

Ensure one automated test proves a non-enrolled student cannot get playback for another course's attached video. The backend e2e from Task 3 is enough if it remains in CI; do not duplicate the same assertion in Playwright.

- [x] **Step 3: Update README**

Add `### P8 Content & Media Management Smoke Test`:

```md
1. Run `docker compose -f docker-compose.infra.yml up -d`.
2. Run `npm run dev`.
3. Sign in as `instructor@example.com` with `Password123!`.
4. Open `Realtime LMS Foundations`.
5. Confirm each lesson row shows either `Video attached` or `No video`.
6. Open the media library from a lesson row, search for `seed-demo`, and attach an unused uploaded media asset when one exists.
7. Detach a lesson video, reattach it from the media library, then sign in as `student@example.com` and confirm `/courses/:courseId/learn` still plays only enrolled course media.
```

- [x] **Step 4: Run full verification**

Run:

```bash
npm run test:backend
npm run test:frontend
npm run typecheck
npm run build
npm run test:e2e:ui -- tests/e2e/p8-media-management.spec.ts
```

Expected: PASS.

- [x] **Step 5: Mark plan complete**

Check every completed box in this file and ensure no unchecked implementation tasks remain.

- [x] **Step 6: Commit**

```bash
git add README.md tests/e2e docs/superpowers/plans/2026-09-11-lms-realtime-p8-content-media-management.md
git commit -m "docs(plan): complete p8 content media management"
```

---

## P8 Acceptance Checklist

- [x] Instructor-created media assets are owned by the uploading user.
- [x] Admin can see all media assets; instructor sees only their own media assets.
- [x] Instructor/admin can list, search, filter, and delete unused media assets.
- [x] Attached media cannot be deleted until detached.
- [x] Instructor/admin can attach, replace, and detach lesson video media.
- [x] Students can create playback URLs only for videos attached to enrolled courses.
- [x] Unattached media is not playable by students.
- [x] Lesson media management UI uses English copy and shadcn-style dark UI primitives.
- [x] Playwright screenshots verify desktop/mobile layout quality for media management UI.
- [x] Backend tests, frontend tests, typecheck, build, and P8 E2E pass.

## Out of Scope for P8

- HLS transcoding.
- Resumable multipart uploads.
- Media waveform/thumbnails.
- Bulk media operations.
- Web push or mobile push notifications.
- OAuth login.
- Multi-tenant organization boundaries.

## Suggested Next Plans

- **P9 Assessment & Analytics:** richer quiz attempts, learner analytics, instructor engagement charts, CSV export.
- **P10 Notification Preferences:** email delivery settings, web notification preferences, digest scheduling.
- **P11 Production Hardening:** structured logging, metrics, backup/restore docs, deployment targets.

## Self-Review

- [x] **Spec coverage:** P8 extends the completed roadmap by hardening the media upload/playback part of P4/P7 and closing previous out-of-scope gaps around media library, lesson playback authorization, and upload E2E.
- [x] **Placeholder scan:** No banned placeholder wording is used; every task includes concrete files, interfaces, tests, verification commands, and commits.
- [x] **Type consistency:** Media library response names are introduced in Task 1 and reused by backend/frontend tasks. Lesson media attach/detach uses `mediaAssetId: string | null` consistently.
