/**
 * Search Query Builder Tests
 * 
 * Tests for the SearchQueryBuilder implementation to ensure
 * proper query construction for Elasticsearch.
 */

import { describe, it, expect } from 'vitest';
import { 
  createSearchQueryBuilder, 
  buildFullTextQuery,
  buildFilteredQuery,
  buildFacetedQuery,
  buildCourseSearchQuery,
  buildLessonSearchQuery
} from '../SearchQueryBuilder.js';

describe('SearchQueryBuilder', () => {
  describe('basic query building', () => {
    it('should build a simple full-text search query', () => {
      const query = createSearchQueryBuilder()
        .query('javascript programming', ['title^2', 'description'])
        .build();

      expect(query.query.bool.must).toHaveLength(1);
      expect(query.query.bool.must[0].multi_match.query).toBe('javascript programming');
      expect(query.query.bool.must[0].multi_match.fields).toEqual(['title^2', 'description']);
      expect(query.query.bool.must[0].multi_match.fuzziness).toBe('AUTO');
    });

    it('should build a match_all query when no text is provided', () => {
      const query = createSearchQueryBuilder()
        .query('', ['title', 'description'])
        .build();

      expect(query.query.bool.must).toHaveLength(1);
      expect(query.query.bool.must[0]).toEqual({ match_all: {} });
    });
  });

  describe('filters', () => {
    it('should add term filters correctly', () => {
      const query = createSearchQueryBuilder()
        .query('test')
        .filterTerms('category', ['programming'])
        .filterTerms('difficulty', ['beginner', 'intermediate'])
        .build();

      expect(query.query.bool.filter).toHaveLength(2);
      expect(query.query.bool.filter[0]).toEqual({ term: { category: 'programming' } });
      expect(query.query.bool.filter[1]).toEqual({ terms: { difficulty: ['beginner', 'intermediate'] } });
    });

    it('should add range filters correctly', () => {
      const query = createSearchQueryBuilder()
        .query('test')
        .filterRange('price', { gte: 10, lte: 100 })
        .filterRange('rating', { gte: 4 })
        .build();

      expect(query.query.bool.filter).toHaveLength(2);
      expect(query.query.bool.filter[0]).toEqual({ range: { price: { gte: 10, lte: 100 } } });
      expect(query.query.bool.filter[1]).toEqual({ range: { rating: { gte: 4 } } });
    });

    it('should add boolean filters correctly', () => {
      const query = createSearchQueryBuilder()
        .query('test')
        .filterBool('isPublished', true)
        .filterBool('isPreview', false)
        .build();

      expect(query.query.bool.filter).toHaveLength(2);
      expect(query.query.bool.filter[0]).toEqual({ term: { isPublished: true } });
      expect(query.query.bool.filter[1]).toEqual({ term: { isPreview: false } });
    });
  });

  describe('sorting', () => {
    it('should add sorting configuration', () => {
      const query = createSearchQueryBuilder()
        .query('test')
        .sortBy('price', 'asc')
        .sortBy('_score', 'desc')
        .build();

      expect(query.sort).toHaveLength(2);
      expect(query.sort[0]).toEqual({ price: { order: 'asc' } });
      expect(query.sort[1]).toBe('_score');
    });

    it('should handle relevance sorting', () => {
      const query = createSearchQueryBuilder()
        .query('test')
        .sortBy('relevance', 'desc')
        .build();

      expect(query.sort).toHaveLength(1);
      expect(query.sort[0]).toBe('_score');
    });
  });

  describe('pagination', () => {
    it('should set pagination parameters', () => {
      const query = createSearchQueryBuilder()
        .query('test')
        .paginate(20, 10)
        .build();

      expect(query.from).toBe(20);
      expect(query.size).toBe(10);
    });
  });

  describe('highlighting', () => {
    it('should configure highlighting', () => {
      const query = createSearchQueryBuilder()
        .query('test')
        .highlightFields(['title', 'description'], {
          preTags: ['<em>'],
          postTags: ['</em>'],
          fragmentSize: 100,
          numberOfFragments: 2,
        })
        .build();

      expect(query.highlight).toBeDefined();
      expect(query.highlight.pre_tags).toEqual(['<em>']);
      expect(query.highlight.post_tags).toEqual(['</em>']);
      expect(query.highlight.fields.title.fragment_size).toBe(100);
      expect(query.highlight.fields.title.number_of_fragments).toBe(2);
    });
  });

  describe('aggregations', () => {
    it('should add terms aggregations', () => {
      const query = createSearchQueryBuilder()
        .query('test')
        .aggregateTerms('categories', 'category.keyword', 15)
        .build();

      expect(query.aggs).toBeDefined();
      expect(query.aggs.categories).toEqual({
        terms: {
          field: 'category.keyword',
          size: 15,
        },
      });
    });

    it('should add range aggregations', () => {
      const query = createSearchQueryBuilder()
        .query('test')
        .aggregateRange('priceRanges', 'price', [
          { key: 'cheap', from: 0, to: 50 },
          { key: 'expensive', from: 100 },
        ])
        .build();

      expect(query.aggs).toBeDefined();
      expect(query.aggs.priceRanges).toEqual({
        range: {
          field: 'price',
          ranges: [
            { key: 'cheap', from: 0, to: 50 },
            { key: 'expensive', from: 100 },
          ],
        },
      });
    });
  });

  describe('utility functions', () => {
    it('should build full-text query using utility function', () => {
      const query = buildFullTextQuery('javascript', ['title^2', 'description'], {
        fuzziness: '1',
        boost: 2.0,
        from: 10,
        size: 5,
      });

      expect(query.query.bool.must[0].multi_match.query).toBe('javascript');
      expect(query.query.bool.must[0].multi_match.fields).toEqual(['title^2', 'description']);
      expect(query.query.bool.must[0].multi_match.fuzziness).toBe('1');
      expect(query.query.bool.must[0].multi_match.boost).toBe(2.0);
      expect(query.from).toBe(10);
      expect(query.size).toBe(5);
    });

    it('should build filtered query using utility function', () => {
      const query = buildFilteredQuery(
        'programming',
        ['title', 'description'],
        {
          terms: { category: ['web', 'mobile'] },
          range: { price: { gte: 0, lte: 100 } },
          bool: { isPublished: true },
        },
        {
          from: 0,
          size: 20,
          sort: [{ field: 'price', order: 'asc' }],
        }
      );

      expect(query.query.bool.must[0].multi_match.query).toBe('programming');
      expect(query.query.bool.filter).toHaveLength(3);
      expect(query.sort).toHaveLength(1);
      expect(query.sort[0]).toEqual({ price: { order: 'asc' } });
    });

    it('should build course search query using utility function', () => {
      const query = buildCourseSearchQuery(
        'javascript',
        {
          category: ['programming'],
          difficulty: ['beginner'],
          priceRange: { min: 0, max: 100 },
        },
        {
          from: 0,
          size: 10,
          sort: { field: 'price', order: 'asc' },
          includeFacets: true,
          highlight: true,
        }
      );

      expect(query.query.bool.must[0].multi_match.query).toBe('javascript');
      expect(query.query.bool.filter).toHaveLength(3);
      expect(query.sort).toHaveLength(2); // price + _score
      expect(query.highlight).toBeDefined();
      expect(query.aggs).toBeDefined();
      expect(query.aggs.categories).toBeDefined();
      expect(query.aggs.difficulties).toBeDefined();
      expect(query.aggs.priceRanges).toBeDefined();
      expect(query.aggs.ratings).toBeDefined();
    });

    it('should build lesson search query using utility function', () => {
      const query = buildLessonSearchQuery(
        'introduction',
        {
          courseId: 'course-123',
          lessonType: ['video', 'text'],
          isPreview: false,
        },
        {
          from: 0,
          size: 20,
          sort: { field: 'order', order: 'asc' },
          highlight: true,
        }
      );

      expect(query.query.bool.must[0].multi_match.query).toBe('introduction');
      expect(query.query.bool.filter).toHaveLength(3);
      expect(query.sort).toHaveLength(1); // orderNumber only since it's the primary sort
      expect(query.highlight).toBeDefined();
    });
  });

  describe('builder chaining and state', () => {
    it('should support method chaining', () => {
      const query = createSearchQueryBuilder()
        .query('test', ['title'])
        .filterTerms('category', ['programming'])
        .sortBy('price', 'asc')
        .paginate(10, 20)
        .highlightFields(['title'])
        .aggregateTerms('categories', 'category')
        .build();

      expect(query.query.bool.must).toHaveLength(1);
      expect(query.query.bool.filter).toHaveLength(1);
      expect(query.sort).toHaveLength(1);
      expect(query.from).toBe(10);
      expect(query.size).toBe(20);
      expect(query.highlight).toBeDefined();
      expect(query.aggs).toBeDefined();
    });

    it('should clone builder state correctly', () => {
      const originalBuilder = createSearchQueryBuilder()
        .query('test', ['title'])
        .filterTerms('category', ['programming']);

      const clonedBuilder = originalBuilder.clone()
        .filterTerms('difficulty', ['beginner']);

      const originalQuery = originalBuilder.build();
      const clonedQuery = clonedBuilder.build();

      expect(originalQuery.query.bool.filter).toHaveLength(1);
      expect(clonedQuery.query.bool.filter).toHaveLength(2);
    });

    it('should reset builder state', () => {
      const builder = createSearchQueryBuilder()
        .query('test', ['title'])
        .filterTerms('category', ['programming'])
        .reset()
        .query('new test');

      const query = builder.build();

      expect(query.query.bool.must[0].multi_match.query).toBe('new test');
      expect(query.query.bool.filter).toBeUndefined();
    });
  });
});