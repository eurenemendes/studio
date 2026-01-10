import type { SVGProps } from "react";

export function DriveVaultLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 11.5l-3.5-2 3.5-2 3.5 2" />
      <path d="M8.5 9.5v3l3.5 2 3.5-2v-3" />
    </svg>
  );
}
