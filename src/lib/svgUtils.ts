const BLOCKED_ELEMENTS = new Set([
    'script',
    'foreignobject',
    'iframe',
    'object',
    'embed',
    'audio',
    'video',
    'link',
    'meta',
    'base',
    'style',
    'animate',
    'animatemotion',
    'animatetransform',
    'set',
    'mpath',
]);

const URL_ATTRIBUTES = new Set(['href', 'xlink:href', 'src']);
const EMPTY_SVG = '<svg xmlns="http://www.w3.org/2000/svg"/>';
const SAFE_IMAGE_URL = /^(?:https:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)/i;

export const sanitizeSvgForDownload = (svgString: string): string => {
    try {
        const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
        const root = doc.documentElement;
        if (root.localName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) {
            return EMPTY_SVG;
        }

        Array.from(doc.querySelectorAll('*')).forEach((element) => {
            const tagName = element.localName.toLowerCase();
            if (BLOCKED_ELEMENTS.has(tagName)) {
                element.remove();
                return;
            }

            Array.from(element.attributes).forEach((attribute) => {
                const name = attribute.name.toLowerCase();
                const value = attribute.value.trim();
                const canonicalValue = Array.from(value)
                    .filter((character) => {
                        const codePoint = character.codePointAt(0) ?? 0;
                        return codePoint > 0x20 && codePoint !== 0x7f && !/\s/u.test(character);
                    })
                    .join('')
                    .toLowerCase();

                if (name.startsWith('on') || name === 'srcdoc' || name === 'style') {
                    element.removeAttribute(attribute.name);
                    return;
                }

                if (/url\s*\(/i.test(value) && !/^url\(#[^)]+\)$/i.test(canonicalValue)) {
                    element.removeAttribute(attribute.name);
                    return;
                }

                if (URL_ATTRIBUTES.has(name)) {
                    const isLocalReference = canonicalValue.startsWith('#');
                    const isSafeImage = tagName === 'image' && SAFE_IMAGE_URL.test(value);
                    if (!isLocalReference && !isSafeImage) {
                        element.removeAttribute(attribute.name);
                    }
                }
            });
        });

        return new XMLSerializer().serializeToString(doc);
    } catch {
        return EMPTY_SVG;
    }
};
