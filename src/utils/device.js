let _isIOS = null;
let _isSafari = null;
let _prefersReducedMotion = null;

export function isIOS() {
  if (_isIOS === null) {
    _isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  return _isIOS;
}

export function isSafari() {
  if (_isSafari === null) {
    const ua = navigator.userAgent;
    _isSafari = /^((?!chrome|android).)*safari/i.test(ua) || isIOS();
  }
  return _isSafari;
}

export function isMobile() {
  return isIOS() || /Android/.test(navigator.userAgent);
}

export function prefersReducedMotion() {
  if (_prefersReducedMotion === null) {
    _prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return _prefersReducedMotion;
}

export function shouldSimplify() {
  return isMobile() || prefersReducedMotion();
}
