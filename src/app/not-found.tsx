import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-x flex min-h-svh flex-col items-start justify-center pt-14">
      <p className="label">Scan failed</p>
      <h1 className="display mt-2 text-[40px]">UNKNOWN WORLD</h1>
      <p className="mt-3 max-w-md text-sm text-muted">This orbit is not on the map. The system, the fleet and the market are.</p>
      <Link href="/system" className="btn btn-primary mt-6">
        Return to system
      </Link>
    </div>
  );
}
