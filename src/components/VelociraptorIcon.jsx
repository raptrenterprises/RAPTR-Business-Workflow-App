// A small velociraptor in the same outline style as the lucide icons used in the nav.
// Takes the same size / color / strokeWidth props, and inherits the text colour by default.
export default function VelociraptorIcon({ size = 24, color = "currentColor", strokeWidth = 2, ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...rest}
    >
      <path d="M1.5 11.4 9 9.6 12.6 6.6 15.8 4.4 19.4 4.4 22.4 7.4 19.4 8.7 17.4 9 16.4 11.8 13.6 14 10 14.6Z" />
      <path d="M10.4 14.6 9.4 18.2 7.6 20.4H11" />
      <path d="M13.4 13.9 13.6 17.6 12.6 20.4H15.8" />
      <path d="M16.2 11.8 18.4 12.8" />
      <circle cx="18.9" cy="6.3" r=".5" fill={color} stroke="none" />
    </svg>
  );
}
