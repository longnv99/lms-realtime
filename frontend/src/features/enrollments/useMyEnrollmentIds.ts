import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listMyEnrollments } from '../../api/enrollments';

export const myEnrollmentsQueryKey = ['my-enrollments'] as const;

export function useMyEnrollmentIds(enabled: boolean) {
  const enrollmentsQuery = useQuery({
    enabled,
    queryKey: myEnrollmentsQueryKey,
    queryFn: listMyEnrollments,
  });

  const enrolledCourseIds = useMemo(
    () => new Set((enrollmentsQuery.data ?? []).map((enrollment) => enrollment.courseId)),
    [enrollmentsQuery.data],
  );

  return { enrolledCourseIds, enrollmentsQuery };
}
