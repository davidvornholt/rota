import { Link } from '@tanstack/react-router';
import { frameClass, linkButtonClass } from '#/shared/ui/classes.ts';
import type { AdminGarment } from '../services/people-fns.ts';
export const WardrobeInspection = ({
  name,
  garments,
}: {
  readonly name: string;
  readonly garments: ReadonlyArray<AdminGarment>;
}) => (
  <div className={frameClass}>
    <Link className={linkButtonClass} to="/people">
      Back to people
    </Link>
    <p className="type-eyebrow mt-6">Read-only wardrobe</p>
    <h1 className="type-display mt-3 text-5xl">{name}</h1>
    {garments.length === 0 ? (
      <p className="mt-8">No garments yet.</p>
    ) : (
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {garments.map((garment) => (
          <li className="border border-rule p-4" key={garment.id}>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['Original', garment.original],
                  ['Studio', garment.studio],
                ] as const
              ).map(([label, key]) =>
                key ? (
                  <figure key={label}>
                    {/* biome-ignore lint/performance/noImgElement: Rota uses Vite; next/image is not available. */}
                    <img
                      decoding="async"
                      loading="lazy"
                      width={600}
                      height={800}
                      alt={`${garment.name || garment.category || 'Garment'} — ${label.toLowerCase()}`}
                      className="aspect-[3/4] w-full bg-paper-deep object-contain"
                      src={`/api/media/${key}`}
                    />
                    <figcaption className="mt-2 text-ink-muted text-sm">
                      {label}
                    </figcaption>
                  </figure>
                ) : null,
              )}
            </div>
            <h2 className="mt-4 text-xl">
              {garment.name || 'Unnamed garment'}
            </h2>
            <p className="mt-1 text-ink-muted">
              {garment.category} · {garment.status}
            </p>
            {garment.notes ? (
              <p className="mt-3 whitespace-pre-wrap text-sm">
                {garment.notes}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    )}
  </div>
);
