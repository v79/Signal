import { describe, it, expect } from 'vitest';
import { parseRichText } from './richText';

describe('parseRichText', () => {
  it('returns empty array for empty input', () => {
    expect(parseRichText('')).toEqual([]);
  });

  it('plain text passes through as a single text node', () => {
    expect(parseRichText('hello world')).toEqual([{ kind: 'text', value: 'hello world' }]);
  });

  it('parses **bold**', () => {
    expect(parseRichText('**YOUR GOAL**')).toEqual([{ kind: 'bold', value: 'YOUR GOAL' }]);
  });

  it('parses *italic*', () => {
    expect(parseRichText('*emphasis*')).toEqual([{ kind: 'italic', value: 'emphasis' }]);
  });

  it('parses __underline__', () => {
    expect(parseRichText('__underlined__')).toEqual([{ kind: 'underline', value: 'underlined' }]);
  });

  it('parses {facility:spaceLaunchCentre}', () => {
    expect(parseRichText('{facility:spaceLaunchCentre}')).toEqual([
      { kind: 'facility', id: 'spaceLaunchCentre' },
    ]);
  });

  it('parses {technology:orbitalMechanics}', () => {
    expect(parseRichText('{technology:orbitalMechanics}')).toEqual([
      { kind: 'tech', id: 'orbitalMechanics' },
    ]);
  });

  it('parses mixed text with bold and a facility token', () => {
    expect(parseRichText('**GOAL** Build a {facility:spaceLaunchCentre} first.')).toEqual([
      { kind: 'bold', value: 'GOAL' },
      { kind: 'text', value: ' Build a ' },
      { kind: 'facility', id: 'spaceLaunchCentre' },
      { kind: 'text', value: ' first.' },
    ]);
  });

  it('treats unmatched ** as literal text', () => {
    expect(parseRichText('no ** close here')).toEqual([{ kind: 'text', value: 'no ** close here' }]);
  });

  it('treats unmatched * as literal text', () => {
    expect(parseRichText('price: 5*3')).toEqual([{ kind: 'text', value: 'price: 5*3' }]);
  });

  it('treats unmatched __ as literal text', () => {
    expect(parseRichText('no __ close')).toEqual([{ kind: 'text', value: 'no __ close' }]);
  });

  it('treats {facility:} with empty id as literal text', () => {
    expect(parseRichText('{facility:}')).toEqual([{ kind: 'text', value: '{facility:}' }]);
  });

  it('treats unknown brace token as literal text', () => {
    const result = parseRichText('{unknown:foo}');
    expect(result[0].kind).toBe('text');
  });

  it('merges adjacent plain text chars into one node', () => {
    expect(parseRichText('abc')).toEqual([{ kind: 'text', value: 'abc' }]);
  });

  it('handles multiple formatters in sequence', () => {
    expect(parseRichText('**A** *B* __C__')).toEqual([
      { kind: 'bold', value: 'A' },
      { kind: 'text', value: ' ' },
      { kind: 'italic', value: 'B' },
      { kind: 'text', value: ' ' },
      { kind: 'underline', value: 'C' },
    ]);
  });

  it('handles {technology:id} with hyphens in id', () => {
    expect(parseRichText('{technology:some-tech-id}')).toEqual([
      { kind: 'tech', id: 'some-tech-id' },
    ]);
  });
});
