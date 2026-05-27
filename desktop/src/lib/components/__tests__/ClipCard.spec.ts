import { render, screen } from '@testing-library/svelte';
import ClipCard from '../ClipCard.svelte';
import { describe, it, expect } from 'vitest';

const baseClip = {
  id: 1,
  content_type: 'text' as const,
  mime: 'text/plain',
  hash: 'h',
  preview: 'hello world',
  source_app: 'firefox',
  is_favorite: false,
  is_pinned: false,
  created_at: Date.now() - 1000,
};

describe('ClipCard', () => {
  it('shows the type badge in uppercase', () => {
    render(ClipCard, { props: { clip: baseClip } });
    expect(screen.getByText('TEXT')).toBeInTheDocument();
  });
  it('draws pin stripe when pinned', () => {
    const { container } = render(ClipCard, {
      props: { clip: { ...baseClip, is_pinned: true } },
    });
    expect(container.querySelector('.pin-stripe')).toBeTruthy();
  });
  it('shows filled star when favorited', () => {
    render(ClipCard, { props: { clip: { ...baseClip, is_favorite: true } } });
    expect(screen.getByText('★')).toBeInTheDocument();
  });
  it('shows empty star when not favorited', () => {
    render(ClipCard, { props: { clip: baseClip } });
    expect(screen.getByText('☆')).toBeInTheDocument();
  });
});
