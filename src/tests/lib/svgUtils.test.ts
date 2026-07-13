import { describe, expect, it } from 'vitest';
import { sanitizeSvgForDownload } from '@/lib/svgUtils';

describe('sanitizeSvgForDownload', () => {
    it('removes active content and dangerous attributes', () => {
        const malicious = `
            <svg xmlns="http://www.w3.org/2000/svg">
                <script>alert(1)</script>
                <foreignObject>
                    <iframe xmlns="http://www.w3.org/1999/xhtml" srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"/>
                </foreignObject>
                <rect onload="alert(1)" style="background:url(javascript:alert(1))"/>
                <a href="javascript:alert(1)"><text>click</text></a>
                <animate attributeName="href" to="javascript:alert(1)"/>
            </svg>
        `;

        const result = sanitizeSvgForDownload(malicious);

        expect(result).not.toMatch(/script|foreignObject|iframe|srcdoc|onload|javascript:|<animate/i);
    });

    it('preserves normal Fabric SVG content and safe image sources', () => {
        const legitimate = `
            <svg xmlns="http://www.w3.org/2000/svg">
                <defs><linearGradient id="paint"><stop offset="0" stop-color="#fff"/></linearGradient></defs>
                <rect width="10" height="10" fill="url(#paint)"/>
                <image href="data:image/png;base64,AAAA" width="1" height="1"/>
                <image href="https://cdn.example.com/image.png" width="1" height="1"/>
            </svg>
        `;

        const result = sanitizeSvgForDownload(legitimate);

        expect(result).toContain('<rect');
        expect(result).toContain('fill="url(#paint)"');
        expect(result).toContain('data:image/png;base64,AAAA');
        expect(result).toContain('https://cdn.example.com/image.png');
    });

    it('fails closed for malformed or non-SVG input', () => {
        expect(sanitizeSvgForDownload('<svg><broken></svg>')).toBe(
            '<svg xmlns="http://www.w3.org/2000/svg"/>'
        );
        expect(sanitizeSvgForDownload('<html></html>')).toBe(
            '<svg xmlns="http://www.w3.org/2000/svg"/>'
        );
    });
});
