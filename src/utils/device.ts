let _isIOS: boolean | null = null;
let _isSafari: boolean | null = null;
let _prefersReducedMotion: boolean | null = null;

export function isIOS(): boolean {
  if (_isIOS === null) {
    _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  return _isIOS;
}

export function isSafari(): boolean {
  if (_isSafari === null) {
    const ua = navigator.userAgent;
    _isSafari = /^((?!chrome|android).)*safari/i.test(ua) || isIOS();
  }
  return _isSafari;
}

export function isMobile(): boolean {
  return isIOS() || /Android/.test(navigator.userAgent);
}

export function prefersReducedMotion(): boolean {
  if (_prefersReducedMotion === null) {
    _prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return _prefersReducedMotion;
}

export function shouldSimplify(): boolean {
  return isMobile() || prefersReducedMotion();
}
