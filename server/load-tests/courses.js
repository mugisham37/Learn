/**
 * Courses Load Test
 * 
 * Tests course browsing, search, and enrollment endpoints
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { GRAPHQL_URL } from './utils/config.js';
import { loginAsTestUser, getAuthHeaders } from './utils/auth.js';
import { getRandomElement } from './utils/config.js';

// Custom metrics
const courseQuerySuccessRate = new Rate('course_query_success_rate');
const enrollmentSuccessRate = new Rate('enrollment_success_rate');
const courseSearchLatency = new Trend('course_search_latency');

export const options = {
  scenarios: {
    course_browsing: {
      executor: 'ramping-vus',
      exec: 'courseBrowsingScenario',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 30 },
        { duration: '2m', target: 100 },
        { duration: '1m', target: 0 },
      ],
    },
    course_search: {
      executor: 'ramping-vus',
      exec: 'courseSearchScenario',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 50 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_duration': ['p(95)<3000'],
    'http_req_failed': ['rate<0.05'],
    'course_query_success_rate': ['rate>0.95'],
    'enrollment_success_rate': ['rate>0.90'],
    'course_search_latency': ['p(95)<2000'],
  },
};

/**
 * Course browsing scenario
 */
export function courseBrowsingScenario() {
  const authResult = loginAsTestUser('student');
  if (!authResult) {
    return;
  }

  const headers = getAuthHeaders(authResult.token);

  // Browse courses with pagination
  const coursesQuery = `
    query Courses($filter: CourseFilter, $pagination: PaginationInput) {
      courses(filter: $filter, pagination: $pagination) {
        edges {
          node {
            id
            title
            description
            instructor {
              profile {
                fullName
              }
            }
            category
            difficulty
            price
            enrollmentCount
            averageRating
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
        totalCount
      }
    }
  `;

  const coursesPayload = {
    query: coursesQuery,
    variables: {
      pagination: {
        first: 20,
        offset: Math.floor(Math.random() * 100),
      },
    },
  };

  const coursesResponse = http.post(GRAPHQL_URL, JSON.stringify(coursesPayload), {
    headers,
  });

  const coursesSuccess = check(coursesResponse, {
    'courses query successful': (r) => r.status === 200,
    'courses query returns data': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.data && data.data.courses && data.data.courses.edges;
      } catch (e) {
        return false;
      }
    },
  });

  courseQuerySuccessRate.add(coursesSuccess);

  if (coursesSuccess) {
    try {
      const data = JSON.parse(coursesResponse.body);
      const courses = data.data.courses.edges;
      
      if (courses.length > 0) {
        // Get details for a random course
        const randomCourse = getRandomElement(courses);
        const courseId = randomCourse.node.id;

        const courseDetailQuery = `
          query Course($id: ID!) {
            course(id: $id) {
              id
              title
              description
              modules {
                id
                title
                lessons {
                  id
                  title
                  type
                  durationMinutes
                }
              }
            }
          }
        `;

        const courseDetailPayload = {
          query: courseDetailQuery,
          variables: { id: courseId },
        };

        const courseDetailResponse = http.post(GRAPHQL_URL, JSON.stringify(courseDetailPayload), {
          headers,
        });

        check(courseDetailResponse, {
          'course detail query successful': (r) => r.status === 200,
          'course detail returns modules': (r) => {
            try {
              const data = JSON.parse(r.body);
              return data.data && data.data.course && data.data.course.modules;
            } catch (e) {
              return false;
            }
          },
        });
      }
    } catch (e) {
      console.error('Failed to parse courses response:', e);
    }
  }

  sleep(1);
}

/**
 * Course search scenario
 */
export function courseSearchScenario() {
  const authResult = loginAsTestUser('student');
  if (!authResult) {
    return;
  }

  const headers = getAuthHeaders(authResult.token);
  const searchTerms = ['javascript', 'python', 'react', 'node', 'database', 'api', 'web', 'mobile'];
  const categories = ['programming', 'design', 'business', 'marketing'];
  const difficulties = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

  const startTime = Date.now();

  const searchQuery = `
    query SearchCourses($filter: CourseFilter, $pagination: PaginationInput) {
      courses(filter: $filter, pagination: $pagination) {
        edges {
          node {
            id
            title
            description
            category
            difficulty
            price
            enrollmentCount
            averageRating
          }
        }
        totalCount
      }
    }
  `;

  const searchTerm = getRandomElement(searchTerms);
  const category = Math.random() > 0.5 ? getRandomElement(categories) : null;
  const difficulty = Math.random() > 0.7 ? getRandomElement(difficulties) : null;

  const searchPayload = {
    query: searchQuery,
    variables: {
      filter: {
        search: searchTerm,
        category,
        difficulty,
        minRating: Math.random() > 0.8 ? 4.0 : null,
      },
      pagination: {
        first: 10,
      },
    },
  };

  const searchResponse = http.post(GRAPHQL_URL, JSON.stringify(searchPayload), {
    headers,
  });

  const searchLatency = Date.now() - startTime;
  courseSearchLatency.add(searchLatency);

  const searchSuccess = check(searchResponse, {
    'course search successful': (r) => r.status === 200,
    'search returns results': (r) => {
      try {
        const data = JSON.parse(r.body);
        return data.data && data.data.courses;
      } catch (e) {
        return false;
      }
    },
  });

  courseQuerySuccessRate.add(searchSuccess);

  sleep(0.5);
}

/**
 * Course enrollment scenario
 */
export function courseEnrollmentScenario() {
  const authResult = loginAsTestUser('student');
  if (!authResult) {
    return;
  }

  const headers = getAuthHeaders(authResult.token);

  // Get available courses first
  const coursesQuery = `
    query Courses($pagination: PaginationInput) {
      courses(pagination: $pagination) {
        edges {
          node {
            id
            title
            price
          }
        }
      }
    }
  `;

  const coursesResponse = http.post(GRAPHQL_URL, JSON.stringify({
    query: coursesQuery,
    variables: { pagination: { first: 5 } },
  }), { headers });

  if (coursesResponse.status === 200) {
    try {
      const data = JSON.parse(coursesResponse.body);
      const courses = data.data.courses.edges;
      
      if (courses.length > 0) {
        const randomCourse = getRandomElement(courses);
        const courseId = randomCourse.node.id;

        // Attempt enrollment
        const enrollMutation = `
          mutation EnrollInCourse($courseId: ID!) {
            enrollInCourse(courseId: $courseId) {
              id
              student {
                id
              }
              course {
                id
                title
              }
              enrolledAt
            }
          }
        `;

        const enrollResponse = http.post(GRAPHQL_URL, JSON.stringify({
          query: enrollMutation,
          variables: { courseId },
        }), { headers });

        const enrollSuccess = check(enrollResponse, {
          'enrollment successful': (r) => r.status === 200,
          'enrollment returns data': (r) => {
            try {
              const data = JSON.parse(r.body);
              return data.data && data.data.enrollInCourse;
            } catch (e) {
              return false;
            }
          },
        });

        enrollmentSuccessRate.add(enrollSuccess);
      }
    } catch (e) {
      console.error('Failed to parse courses for enrollment:', e);
    }
  }

  sleep(2);
}

/**
 * Default mixed scenario
 */
export default function() {
  const scenario = Math.random();
  
  if (scenario < 0.5) {
    courseBrowsingScenario();
  } else if (scenario < 0.8) {
    courseSearchScenario();
  } else {
    courseEnrollmentScenario();
  }
}