import React from 'react';
import { Cpu } from 'lucide-react';

interface TechIconProps {
  name: string;
  className?: string;
}

export const TechIcon: React.FC<TechIconProps> = ({ name, className = 'w-3.5 h-3.5 shrink-0' }) => {
  const norm = name.toLowerCase().trim();

  // React
  if (norm.includes('react')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="#00d8ff" strokeWidth="1.6" role="img" aria-label="React logo">
        <circle cx="12" cy="12" r="2" fill="#00d8ff" stroke="none" />
        <ellipse cx="12" cy="12" rx="10" ry="4" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)" />
      </svg>
    );
  }

  // Next.js
  if (norm.includes('next')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" role="img" aria-label="Next.js logo">
        <circle cx="12" cy="12" r="11" className="fill-zinc-900 dark:fill-white" />
        <path
          d="M8.5 7.5v9h2v-4.8l5.5 5.8h1.8V7.5h-2v4.8L10.3 7.5H8.5z"
          className="fill-white dark:fill-zinc-900"
        />
      </svg>
    );
  }

  // Tailwind CSS
  if (norm.includes('tailwind')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="#38bdf8" role="img" aria-label="Tailwind CSS logo">
        <path d="M12.001 4.8c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624C13.666 10.618 15.027 12 18.001 12c3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C16.335 6.182 14.974 4.8 12.001 4.8zm-6 7.2c-3.2 0-5.2 1.6-6 4.8 1.2-1.6 2.6-2.2 4.2-1.8.913.228 1.565.89 2.288 1.624 1.177 1.194 2.538 2.576 5.512 2.576 3.2 0 5.2-1.6 6-4.8-1.2 1.6-2.6 2.2-4.2 1.8-.913-.228-1.565-.89-2.288-1.624C10.335 13.382 8.974 12 6.001 12z" />
      </svg>
    );
  }

  // Vercel
  if (norm.includes('vercel')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" role="img" aria-label="Vercel logo">
        <path d="M12 3l10 17H2L12 3z" />
      </svg>
    );
  }

  // Vue.js
  if (norm.includes('vue')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" role="img" aria-label="Vue.js logo">
        <path d="M2 3h3.5L12 14.5 18.5 3H22L12 21 2 3z" fill="#42b883" />
        <path d="M6.5 3h3.5L12 6.5 14 3h3.5L12 11.5 6.5 3z" fill="#35495e" />
      </svg>
    );
  }

  // Nuxt.js
  if (norm.includes('nuxt')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" role="img" aria-label="Nuxt logo">
        <path d="M13.8 15.5l-3.3-6.1c-.2-.4-.7-.4-.9 0L2.8 21.6c-.2.4.1.8.5.8h6.8l3.7-6.9zm6.9 6.9c.4 0 .7-.4.5-.8L16.4 9.4c-.2-.4-.7-.4-.9 0l-1.9 3.5 3.3 6.1c.2.4-.1.8-.5.8h4.3z" fill="#00dc82" />
      </svg>
    );
  }

  // Svelte
  if (norm.includes('svelte')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="#ff3e00" role="img" aria-label="Svelte logo">
        <path d="M20.2 4.6c-2.3-2.6-6-3.1-9.1-1.4l-4.5 2.5C4 7.2 2.6 10 3 12.8c.3 2 1.4 3.7 3.2 4.7l-1.1 1.9c-.3.5-.1 1.2.4 1.5.5.3 1.2.1 1.5-.4l1.3-2.3c2.4 1 5.2.7 7.3-.8l4.5-2.5c2.6-1.5 4-4.3 3.6-7.1-.3-1.9-1.5-3.7-3.2-4.7l1.1-1.9c.3-.5.1-1.2-.4-1.5-.5-.4-1.2-.2-1.5.4l-1.1 1.9z" />
      </svg>
    );
  }

  // Angular
  if (norm.includes('angular')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" role="img" aria-label="Angular logo">
        <path d="M12 2L2 5.5l1.5 13L12 22l8.5-3.5 1.5-13L12 2z" fill="#dd0031" />
        <path d="M12 2v20l8.5-3.5 1.5-13L12 2z" fill="#c3002f" />
        <path d="M12 5.5l-5 11.5h2.1l1-2.6h3.8l1 2.6H17L12 5.5zm1.3 7h-2.6L12 9.5l1.3 3z" fill="#fff" />
      </svg>
    );
  }

  // Astro
  if (norm.includes('astro')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="#ff5d01" role="img" aria-label="Astro logo">
        <path d="M12 2C8 7 4 13 4 17c0 4.4 3.6 5 8 5s8-.6 8-5c0-4-4-10-8-15zm0 15c-1.1 0-2-.9-2-2 0-1.5 2-4 2-4s2 2.5 2 4c0 1.1-.9 2-2 2z" />
      </svg>
    );
  }

  // WordPress
  if (norm.includes('wordpress')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="#21759b" role="img" aria-label="WordPress logo">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 3.5c-4.7 0-8.5 3.8-8.5 8.5 0 2.2.8 4.2 2.2 5.7L8.9 9.8c.4-1.1.8-1.5 1.4-1.5h.3l-3.3 9.7C9 19.8 10.4 20.5 12 20.5c1.8 0 3.5-.6 4.8-1.7l-4.1-11.8c.5 0 .9.3 1.2 1.2l3 8.8c1.5-1.5 2.6-3.6 2.6-6 0-4.7-3.8-8.5-8.5-8.5z" fill="#fff" />
      </svg>
    );
  }

  // Shopify
  if (norm.includes('shopify')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="#96bf48" role="img" aria-label="Shopify logo">
        <path d="M17.5 4.5l-2.2-.7c-.2 0-.3.1-.4.2l-.7 1.8H9.3l-.7-1.8c0-.1-.2-.2-.4-.2L6 4.5c-.2 0-.3.2-.3.4l-2 15.2c0 .2.1.4.3.4h15.5c.2 0 .4-.2.4-.4L17.8 4.9c0-.2-.1-.4-.3-.4zM12 16.5c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" />
      </svg>
    );
  }

  // Cloudflare
  if (norm.includes('cloudflare')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="#f38020" role="img" aria-label="Cloudflare logo">
        <path d="M18.8 11.2c-.4-3-3-5.2-6.1-5.2-2.7 0-5 1.7-5.8 4.2C5.4 10.5 4 11.8 4 13.5c0 2 1.6 3.5 3.5 3.5h11c1.9 0 3.5-1.6 3.5-3.5 0-1.3-.7-2.4-1.8-3l-1.4.7z" />
      </svg>
    );
  }

  // Node.js
  if (norm.includes('node')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="#539e43" role="img" aria-label="Node.js logo">
        <path d="M12 2l9 5.2v10.4L12 22.8 3 17.6V7.2L12 2zm0 3.2L5.5 8.9v6.2L12 18.8l6.5-3.7V8.9L12 5.2z" />
      </svg>
    );
  }

  // Python
  if (norm.includes('python')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" role="img" aria-label="Python logo">
        <path d="M11.9 2c-4 0-3.8 1.7-3.8 1.7v1.8h3.9v.6H4.6S2 5.8 2 9.9c0 4 2.3 3.9 2.3 3.9h1.4v-1.9c0-2.2 1.9-2.2 1.9-2.2h3.9c1.9 0 1.9-1.8 1.9-1.8V4.1s.3-2.1-1.5-2.1zm-1.8 1.1c.3 0 .6.3.6.6s-.3.6-.6.6-.6-.3-.6-.6.3-.6.6-.6z" fill="#3776ab" />
        <path d="M12.1 22c4 0 3.8-1.7 3.8-1.7v-1.8h-3.9v-.6h7.4s2.6.3 2.6-3.8c0-4-2.3-3.9-2.3-3.9h-1.4v1.9c0 2.2-1.9 2.2-1.9 2.2h-3.9c-1.9 0-1.9 1.8-1.9 1.8v3.8s-.3 2.1 1.5 2.1zm1.8-1.1c-.3 0-.6-.3-.6-.6s.3-.6.6-.6.6.3.6.6-.3.6-.6.6z" fill="#ffd43b" />
      </svg>
    );
  }

  // PHP
  if (norm.includes('php')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="#777bb4" role="img" aria-label="PHP logo">
        <ellipse cx="12" cy="12" rx="10" ry="6" />
        <path d="M8 9h2c.8 0 1.5.5 1.5 1.5S10.8 12 10 12H9v3H8V9zm1 2h1c.3 0 .5-.2.5-.5s-.2-.5-.5-.5H9v1zm4-2h1v6h-1v-2h-1v2h-1V9h1v2h1V9zm3 0h2c.8 0 1.5.5 1.5 1.5S18.8 12 18 12h-1v3h-1V9zm1 2h1c.3 0 .5-.2.5-.5s-.2-.5-.5-.5h-1v1z" fill="#fff" />
      </svg>
    );
  }

  // Nginx
  if (norm.includes('nginx')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="#009639" role="img" aria-label="Nginx logo">
        <path d="M12 2L2 7.8v8.4L12 22l10-5.8V7.8L12 2zm3.5 13.5h-1.8l-3.4-5.2v5.2H8.5V8.5h1.8l3.4 5.2V8.5h1.8v7z" />
      </svg>
    );
  }

  // Bootstrap
  if (norm.includes('bootstrap')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="#7952b3" role="img" aria-label="Bootstrap logo">
        <rect x="2" y="2" width="20" height="20" rx="4" />
        <path d="M8 6h4.5c1.4 0 2.5.8 2.5 2 0 .8-.5 1.5-1.2 1.8 1 .3 1.7 1.1 1.7 2.2 0 1.4-1.2 2-2.7 2H8V6zm2.2 3.3h2c.5 0 .9-.3.9-.8s-.4-.8-.9-.8h-2v1.6zm0 3.2h2.2c.6 0 1-.3 1-.9s-.4-.9-1-.9h-2.2v1.8z" fill="#fff" />
      </svg>
    );
  }

  // jQuery
  if (norm.includes('jquery')) {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="#0769ad" role="img" aria-label="jQuery logo">
        <circle cx="12" cy="12" r="10" />
        <path d="M15.5 8c-.6 0-1.2.3-1.5.8-.3-.5-.9-.8-1.5-.8-1.1 0-2 .9-2 2v6h1.5v-5.5c0-.6.4-1 1-1s1 .4 1 1V16H15v-5.5c0-.6.4-1 1-1s1 .4 1 1V16h1.5v-6c0-1.1-.9-2-2-2z" fill="#fff" />
      </svg>
    );
  }

  // Default fallback
  return <Cpu className={`${className} text-zinc-400 dark:text-zinc-500`} />;
};
