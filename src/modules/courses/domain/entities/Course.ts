import {
  CourseCreatedEvent,
  CoursePublishedEvent,
  CourseUpdatedEvent,
  DomainEvent,
  ModuleAddedEvent,
  ModuleRemovedEvent,
  ModulesReorderedEvent,
} from '../events/CourseEvents';

import { CourseModule } from './CourseModule';

export type CourseStatus = 'draft' | 'pending_review' | 'published' | 'archived';
export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface CourseProps {
  id: string;
  instructorId: string;
  title: string;
  description: string;
  slug: string;
  category: string;
  difficulty: CourseDifficulty;
  price: number;
  currency: string;
  enrollmentLimit?: number;
  enrollmentCount: number;
  averageRating?: number;
  totalReviews: number;
  status: CourseStatus;
  publishedAt?: Date;
  thumbnailUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Course {
  private _props: CourseProps;
  private _modules: CourseModule[] = [];
  private _domainEvents: DomainEvent[] = [];

  constructor(props: CourseProps) {
    this.validateProps(props);
    this._props = { ...props };
  }

  // Getters
  get id(): string {
    return this._props.id;
  }
  get instructorId(): string {
    return this._props.instructorId;
  }
  get title(): string {
    return this._props.title;
  }
  get description(): string {
    return this._props.description;
  }
  get slug(): string {
    return this._props.slug;
  }
  get category(): string {
    return this._props.category;
  }
  get difficulty(): CourseDifficulty {
    return this._props.difficulty;
  }
  get price(): number {
    return this._props.price;
  }
  get currency(): string {
    return this._props.currency;
  }
  get enrollmentLimit(): number | undefined {
    return this._props.enrollmentLimit;
  }
  get enrollmentCount(): number {
    return this._props.enrollmentCount;
  }
  get averageRating(): number | undefined {
    return this._props.averageRating;
  }
  get totalReviews(): number {
    return this._props.totalReviews;
  }
  get status(): CourseStatus {
    return this._props.status;
  }
  get publishedAt(): Date | undefined {
    return this._props.publishedAt;
  }
  get thumbnailUrl(): string | undefined {
    return this._props.thumbnailUrl;
  }
  get createdAt(): Date {
    return this._props.createdAt;
  }
  get updatedAt(): Date {
    return this._props.updatedAt;
  }
  get modules(): CourseModule[] {
    return [...this._modules];
  }
  get domainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }

  // Static factory method for creating new courses
  static create(
    props: Omit<
      CourseProps,
      'id' | 'slug' | 'enrollmentCount' | 'totalReviews' | 'status' | 'createdAt' | 'updatedAt'
    >
  ): Course {
    const now = new Date();
    const slug = this.generateSlug(props.title);

    const courseProps: CourseProps = {
      ...props,
      id: crypto.randomUUID(),
      slug,
      enrollmentCount: 0,
      totalReviews: 0,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    const course = new Course(courseProps);
    course.addDomainEvent(new CourseCreatedEvent(course.id, course.instructorId, course.title));

    return course;
  }

  // Generate unique slug from title
  static generateSlug(title: string): string {
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();

    // Add timestamp and random component to ensure uniqueness
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${baseSlug}-${timestamp}-${random}`;
  }

  // Update course properties
  update(
    updates: Partial<
      Pick<
        CourseProps,
        | 'title'
        | 'description'
        | 'category'
        | 'difficulty'
        | 'price'
        | 'enrollmentLimit'
        | 'thumbnailUrl'
      >
    >
  ): void {
    const oldTitle = this._props.title;

    // Create updated props for validation
    const updatedProps = { ...this._props, ...updates, updatedAt: new Date() };

    // Regenerate slug if title changed
    if (updates.title && updates.title !== oldTitle) {
      updatedProps.slug = Course.generateSlug(updates.title);
    }

    // Validate the updated properties
    this.validateProps(updatedProps);

    // Apply the updates
    this._props = updatedProps;
    this.addDomainEvent(new CourseUpdatedEvent(this.id, this.instructorId));
  }

  // Add module to course
  addModule(module: CourseModule): void {
    // Ensure unique order numbers
    const existingOrderNumbers = this._modules.map((m) => m.orderNumber);
    if (existingOrderNumbers.includes(module.orderNumber)) {
      throw new Error(`Module with order number ${module.orderNumber} already exists`);
    }

    this._modules.push(module);
    this._props.updatedAt = new Date();

    this.addDomainEvent(new ModuleAddedEvent(this.id, module.id, module.title, module.orderNumber));
  }

  // Remove module from course
  removeModule(moduleId: string): void {
    const moduleIndex = this._modules.findIndex((m) => m.id === moduleId);
    if (moduleIndex === -1) {
      throw new Error(`Module with id ${moduleId} not found`);
    }

    this._modules.splice(moduleIndex, 1);
    this._props.updatedAt = new Date();

    this.addDomainEvent(new ModuleRemovedEvent(this.id, moduleId));
  }

  // Reorder modules
  reorderModules(moduleIds: string[]): void {
    if (moduleIds.length !== this._modules.length) {
      throw new Error('Module IDs count must match existing modules count');
    }

    // Verify all module IDs exist
    const existingIds = new Set(this._modules.map((m) => m.id));
    const providedIds = new Set(moduleIds);

    if (
      existingIds.size !== providedIds.size ||
      !Array.from(existingIds).every((id) => providedIds.has(id))
    ) {
      throw new Error('Invalid module IDs provided');
    }

    // Reorder modules and update order numbers
    const reorderedModules: CourseModule[] = [];
    moduleIds.forEach((moduleId, index) => {
      const module = this._modules.find((m) => m.id === moduleId)!;
      module.updateOrderNumber(index + 1);
      reorderedModules.push(module);
    });

    this._modules = reorderedModules;
    this._props.updatedAt = new Date();

    const newOrder = reorderedModules.map((module) => ({
      moduleId: module.id,
      orderNumber: module.orderNumber,
    }));

    this.addDomainEvent(new ModulesReorderedEvent(this.id, newOrder));
  }

  // Validate course can be published
  canPublish(): { canPublish: boolean; reasons: string[] } {
    const reasons: string[] = [];

    // Must have at least 3 modules
    if (this._modules.length < 3) {
      reasons.push('Course must have at least 3 modules');
    }

    // Each module must have content
    const modulesWithoutContent = this._modules.filter((module) => module.lessons.length === 0);
    if (modulesWithoutContent.length > 0) {
      reasons.push('All modules must have at least one lesson');
    }

    // All video lessons must be processed
    const unprocessedVideos = this._modules
      .flatMap((module) => module.lessons)
      .filter((lesson) => lesson.type === 'video' && !lesson.contentUrl);

    if (unprocessedVideos.length > 0) {
      reasons.push('All video lessons must be processed before publishing');
    }

    return {
      canPublish: reasons.length === 0,
      reasons,
    };
  }

  // Publish course
  publish(): void {
    const validation = this.canPublish();
    if (!validation.canPublish) {
      throw new Error(`Cannot publish course: ${validation.reasons.join(', ')}`);
    }

    this._props.status = 'published';
    this._props.publishedAt = new Date();
    this._props.updatedAt = new Date();

    this.addDomainEvent(new CoursePublishedEvent(this.id, this.instructorId, this.title));
  }

  // Archive course
  archive(): void {
    this._props.status = 'archived';
    this._props.updatedAt = new Date();
  }

  // Update enrollment count
  updateEnrollmentCount(count: number): void {
    if (count < 0) {
      throw new Error('Enrollment count cannot be negative');
    }

    this._props.enrollmentCount = count;
    this._props.updatedAt = new Date();
  }

  // Update rating
  updateRating(averageRating: number, totalReviews: number): void {
    if (averageRating < 0 || averageRating > 5) {
      throw new Error('Average rating must be between 0 and 5');
    }
    if (totalReviews < 0) {
      throw new Error('Total reviews cannot be negative');
    }

    this._props.averageRating = averageRating;
    this._props.totalReviews = totalReviews;
    this._props.updatedAt = new Date();
  }

  // Set modules (for loading from database)
  setModules(modules: CourseModule[]): void {
    this._modules = [...modules];
  }

  // Clear domain events
  clearDomainEvents(): void {
    this._domainEvents = [];
  }

  // Private methods
  private validateProps(props: CourseProps): void {
    if (!props.title || props.title.trim().length === 0) {
      throw new Error('Course title is required');
    }
    if (props.title.length > 255) {
      throw new Error('Course title cannot exceed 255 characters');
    }
    if (!props.description || props.description.trim().length === 0) {
      throw new Error('Course description is required');
    }
    if (!props.category || props.category.trim().length === 0) {
      throw new Error('Course category is required');
    }
    if (props.price < 0) {
      throw new Error('Course price cannot be negative');
    }
    if (props.enrollmentLimit !== undefined && props.enrollmentLimit <= 0) {
      throw new Error('Enrollment limit must be positive');
    }
    if (props.enrollmentCount < 0) {
      throw new Error('Enrollment count cannot be negative');
    }
    if (props.totalReviews < 0) {
      throw new Error('Total reviews cannot be negative');
    }
    if (props.averageRating !== undefined && (props.averageRating < 0 || props.averageRating > 5)) {
      throw new Error('Average rating must be between 0 and 5');
    }
  }

  private addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event);
  }
}
