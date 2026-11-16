import { useId } from 'react';

// Separate SVG layers let the login mascot move without a video or animation library.
export default function CatMascot({ variant = 'character', className = '' }) {
  const id = useId();
  const icon = variant === 'icon';
  const silhouette = icon
    ? 'M330 435 C268 402 249 353 272 297 C289 253 328 223 366 211 L392 156 Q399 143 414 156 L452 194 C490 183 533 183 564 198 L619 156 Q633 146 640 165 L659 222 C720 239 755 280 754 331 C756 375 733 411 695 431 C718 464 718 509 695 542 C665 586 593 607 514 608 C429 608 355 588 326 544 C305 512 303 471 320 443'
    : 'M207 581 C156 553 127 503 129 438 C119 353 163 280 235 250 L283 232 L318 150 Q331 126 355 145 L422 210 C473 192 541 191 590 215 L683 146 Q703 133 715 164 L745 254 C820 275 869 324 884 392 C903 477 871 549 805 583 C835 621 837 679 816 719 C787 773 730 804 650 831 C643 868 626 891 602 887 C579 884 574 862 572 841 C534 851 493 850 461 846 C455 877 442 893 420 889 C397 886 384 864 382 835 C317 814 251 789 220 745 C191 704 187 635 207 581 Z';

  return (
    <svg
      className={`cat-mascot cat-mascot-${variant} ${className}`}
      viewBox={icon ? '190 70 645 625' : '72 80 900 870'}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-orange`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e7b698" />
          <stop offset="1" stopColor="#d99c80" />
        </linearGradient>
        <linearGradient id={`${id}-blue`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#def6ff" />
          <stop offset="1" stopColor="#c4e8f5" />
        </linearGradient>
        <clipPath id={`${id}-body`}>
          <path d={silhouette} />
        </clipPath>
      </defs>
      {icon && (
        <rect
          x="222"
          y="101"
          width="580"
          height="562"
          rx="116"
          fill={`url(#${id}-blue)`}
          stroke="#304c59"
          strokeWidth="21"
        />
      )}
      <g className={icon ? undefined : 'mascot-bob'}>
        <path d={silhouette} fill="#fff" />
        <g clipPath={`url(#${id}-body)`}>
          <path
            d={
              icon
                ? 'M245 115 H507 C523 208 527 267 487 302 C435 348 340 329 252 318 Z'
                : 'M111 116 H506 C518 199 529 270 504 324 C475 398 422 417 345 417 C263 417 181 415 116 402 Z'
            }
            fill={`url(#${id}-orange)`}
          />
        </g>
        <path
          d={silhouette}
          fill="none"
          stroke="#090b0b"
          strokeWidth={icon ? 11 : 16}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g transform={icon ? 'translate(185 66) scale(.64)' : undefined}>
          <ellipse cx="363" cy="406" rx="44" ry="22" fill={icon ? '#f5ac93' : '#f6bbb8'} />
          <ellipse cx="654" cy="402" rx="44" ry="20" fill={icon ? '#f5ac93' : '#f6bbb8'} />
          <g className={icon ? undefined : 'mascot-gaze'}>
            <g className={icon ? undefined : 'mascot-eye mascot-eye-left'}>
              <ellipse cx="396" cy="334" rx="34" ry="35" fill="#080a09" />
              <ellipse cx="386" cy="322" rx="8" ry="9" fill="#fff" />
              <circle cx="405" cy="348" r="7" fill="#fff" />
            </g>
            <g className={icon ? undefined : 'mascot-eye mascot-eye-right'}>
              <ellipse cx="623" cy="333" rx="34" ry="35" fill="#080a09" />
              <ellipse cx="612" cy="320" rx="8" ry="9" fill="#fff" />
              <circle cx="631" cy="347" r="7" fill="#fff" />
            </g>
          </g>
          <g className="mascot-mouth">
            <path d="M481 476 Q489 513 511 513 Q533 513 542 476 Q512 487 481 476 Z" fill="#f4939b" />
            <path
              d="M481 476 Q489 513 511 513 Q533 513 542 476"
              fill="none"
              stroke="#090b0b"
              strokeWidth="10"
              strokeLinecap="round"
            />
          </g>
          <path
            d="M457 428 C439 451 450 475 475 473 C499 473 511 454 511 431 C508 456 527 474 548 468 C575 464 581 442 565 422"
            fill="none"
            stroke="#090b0b"
            strokeWidth="13"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
        {!icon && (
          <>
            <path
              d="M300 630 C327 647 350 627 364 655 C390 694 353 712 293 700"
              fill="none"
              stroke="#090b0b"
              strokeWidth="16"
              strokeLinecap="round"
            />
            <path
              d="M727 325 Q744 307 762 304 M731 362 Q750 337 781 329"
              fill="none"
              stroke="#090b0b"
              strokeWidth="11"
              strokeLinecap="round"
            />
            <g className="mascot-wave">
              <path
                d="M685 542 C713 511 726 456 745 414 C762 375 781 359 805 375 C842 395 852 426 843 468 C832 521 808 572 777 604 Z"
                fill="#fff"
              />
              <path
                d="M685 542 C713 511 726 456 745 414 C762 375 781 359 805 375 C842 395 852 426 843 468 C832 521 808 572 777 604"
                fill="none"
                stroke="#090b0b"
                strokeWidth="17"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            <g
              className="mascot-wave-lines"
              fill="none"
              stroke="#090b0b"
              strokeWidth="12"
              strokeLinecap="round"
            >
              <path d="M908 345 Q934 376 925 416" />
              <path d="M945 338 Q961 359 954 385" />
            </g>
          </>
        )}
      </g>
    </svg>
  );
}
