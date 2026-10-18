import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// always start a page load at the top: the story is built to be scrolled from the start
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// One smooth-scroll instance for the whole site, driven by GSAP's ticker so
// scroll-linked animations and the scroll position never drift apart.
export const lenis: Lenis | null = reducedMotion ? null : new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 })

if (lenis) {
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)
}

export function scrollToTop() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true })
  else window.scrollTo(0, 0)
}

export { gsap, ScrollTrigger }
