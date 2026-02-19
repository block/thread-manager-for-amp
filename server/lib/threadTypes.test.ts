import { describe, it, expect } from 'vitest';
import {
  isTextContent,
  isToolUseContent,
  isImageContent,
  isHandoffRelationship,
} from './threadTypes.js';

describe('isTextContent', () => {
  it('returns true for valid text content', () => {
    expect(isTextContent({ type: 'text', text: 'hello' })).toBe(true);
  });

  it('returns true for text content without text field', () => {
    expect(isTextContent({ type: 'text' })).toBe(true);
  });

  it('returns false for string values', () => {
    expect(isTextContent('hello')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isTextContent(null)).toBe(false);
  });

  it('returns false for other content types', () => {
    expect(isTextContent({ type: 'tool_use' })).toBe(false);
    expect(isTextContent({ type: 'image' })).toBe(false);
  });

  it('returns false for objects without type', () => {
    expect(isTextContent({ text: 'hello' })).toBe(false);
  });
});

describe('isToolUseContent', () => {
  it('returns true for valid tool_use content', () => {
    expect(isToolUseContent({ type: 'tool_use', name: 'edit_file', input: {} })).toBe(true);
  });

  it('returns true for tool_use without optional fields', () => {
    expect(isToolUseContent({ type: 'tool_use' })).toBe(true);
  });

  it('returns false for string values', () => {
    expect(isToolUseContent('tool_use')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isToolUseContent(null)).toBe(false);
  });

  it('returns false for other content types', () => {
    expect(isToolUseContent({ type: 'text' })).toBe(false);
  });
});

describe('isImageContent', () => {
  it('returns true for valid image content', () => {
    expect(isImageContent({ type: 'image', source: { data: 'abc' } })).toBe(true);
  });

  it('returns true for image without source', () => {
    expect(isImageContent({ type: 'image' })).toBe(true);
  });

  it('returns false for string values', () => {
    expect(isImageContent('image')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isImageContent(null)).toBe(false);
  });

  it('returns false for other content types', () => {
    expect(isImageContent({ type: 'text' })).toBe(false);
  });
});

describe('isHandoffRelationship', () => {
  it('returns true for parent handoff', () => {
    expect(
      isHandoffRelationship({
        type: 'handoff',
        role: 'parent',
        threadID: 'T-123',
      }),
    ).toBe(true);
  });

  it('returns true for child handoff', () => {
    expect(
      isHandoffRelationship({
        type: 'handoff',
        role: 'child',
        threadID: 'T-456',
        comment: 'some context',
      }),
    ).toBe(true);
  });

  it('returns false for non-handoff type', () => {
    expect(
      isHandoffRelationship({
        type: 'fork',
        role: 'parent',
        threadID: 'T-123',
      }),
    ).toBe(false);
  });

  it('returns false for invalid role', () => {
    expect(
      isHandoffRelationship({
        type: 'handoff',
        role: 'sibling',
        threadID: 'T-123',
      }),
    ).toBe(false);
  });

  it('returns false for missing threadID', () => {
    expect(
      isHandoffRelationship({
        type: 'handoff',
        role: 'parent',
      }),
    ).toBe(false);
  });

  it('returns false for non-string threadID', () => {
    expect(
      isHandoffRelationship({
        type: 'handoff',
        role: 'parent',
        threadID: 123,
      }),
    ).toBe(false);
  });

  it('returns false for null', () => {
    expect(isHandoffRelationship(null)).toBe(false);
  });

  it('returns false for string values', () => {
    expect(isHandoffRelationship('handoff')).toBe(false);
  });
});
