import type { ReactNode } from 'react';
import { Heading } from '../../ui/typography';

interface DesignSystemPageProps {
  headerSlot?: ReactNode;
}

export function DesignSystemPage({ headerSlot }: DesignSystemPageProps) {
  return (
    <div className="min-h-screen bg-surface text-text p-10 font-sans transition-colors duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold mb-1">Design System</h1>
          <p className="text-text-muted text-sm">Polygon UI Kit</p>
        </div>
        {headerSlot}
      </div>

      {/* Purple shades */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">
          Purple Shades
        </h2>
        <div className="flex flex-wrap gap-3">
          {[
            ['bg-purple-60', '#703bf7', '60'],
            ['bg-purple-65', '#8254f8', '65'],
            ['bg-purple-70', '#946cf9', '70'],
            ['bg-purple-75', '#a685fa', '75'],
            ['bg-purple-90', '#dbcefd', '90'],
            ['bg-purple-95', '#ede7fe', '95'],
            ['bg-purple-97', '#f4f0fe', '97'],
            ['bg-purple-99', '#fbfaff', '99'],
          ].map(([cls, hex, label]) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className={`w-12 h-12 rounded-md border border-border ${cls}`}
              />
              <span className="text-[10px] text-text-muted">{label}</span>
              <span className="text-[10px] text-gray-40">{hex}</span>
            </div>
          ))}
        </div>
      </section>

      {/* White shades */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">
          White Shades
        </h2>
        <div className="flex flex-wrap gap-3">
          {[
            ['bg-white-90', '#e4e4e7', '90'],
            ['bg-white-95', '#f1f1f3', '95'],
            ['bg-white-97', '#f7f7f8', '97'],
            ['bg-white-99', '#fcfcfd', '99'],
            ['bg-white', '#ffffff', '100'],
          ].map(([cls, hex, label]) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className={`w-12 h-12 rounded-md border border-border ${cls}`}
              />
              <span className="text-[10px] text-text-muted">{label}</span>
              <span className="text-[10px] text-gray-40">{hex}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Gray shades */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">
          Gray Shades
        </h2>
        <div className="flex flex-wrap gap-3">
          {[
            ['bg-black', '#000000', '00'],
            ['bg-gray-09', '#141414', '09'],
            ['bg-gray-10', '#1a1a1a', '10'],
            ['bg-gray-15', '#262626', '15'],
            ['bg-gray-20', '#333333', '20'],
            ['bg-gray-30', '#4d4d4d', '30'],
            ['bg-gray-40', '#666666', '40'],
            ['bg-gray-50', '#808080', '50'],
            ['bg-gray-60', '#999999', '60'],
          ].map(([cls, hex, label]) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className={`w-12 h-12 rounded-md border border-border ${cls}`}
              />
              <span className="text-[10px] text-text-muted">{label}</span>
              <span className="text-[10px] text-gray-40">{hex}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Semantic tokens */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">
          Semantic Tokens
        </h2>
        <div className="flex flex-wrap gap-3">
          {[
            ['bg-primary', 'primary'],
            ['bg-surface', 'surface'],
            ['bg-surface-elevated', 'surface-elevated'],
            ['bg-border', 'border'],
            ['bg-danger', 'danger'],
          ].map(([cls, label]) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className={`w-12 h-12 rounded-md border border-border ${cls}`}
              />
              <span className="text-[10px] text-text-muted">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Typography */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">
          Typography
        </h2>
        <div className="space-y-4">
          {([1, 2, 3, 4, 5, 6] as const).map((level) => (
            <div key={level} className="flex items-baseline gap-4">
              <span className="text-[10px] text-text-muted w-4">h{level}</span>
              <Heading level={level}>The quick brown fox</Heading>
            </div>
          ))}

          <div className="pt-4 border-t border-border space-y-1">
            <p className="text-xs text-text-muted mb-2 uppercase tracking-widest">
              Override & sr-only
            </p>
            <div className="flex items-baseline gap-4">
              <span className="text-[10px] text-text-muted w-16">h1 as h3</span>
              <Heading level={3} as="h1">
                Looks like h3, tag is h1
              </Heading>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] text-text-muted w-16">sr-only</span>
              <span className="text-sm text-text-muted italic">
                [ невидим — только для скринридеров ]
              </span>
              <Heading level={2} srOnly>
                Hidden heading for screen readers
              </Heading>
            </div>
          </div>
        </div>
      </section>

      {/* Buttons */}
      <section className="mb-10">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">
          Buttons
        </h2>
        <div className="flex flex-wrap gap-3">
          <button className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Primary
          </button>
          <button className="bg-surface-elevated hover:bg-border text-text px-4 py-2 rounded-md text-sm font-medium border border-border transition-colors">
            Secondary
          </button>
          <button className="text-text-muted hover:text-text px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Ghost
          </button>
          <button className="bg-danger text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
            Danger
          </button>
        </div>
      </section>

      {/* Surfaces */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-muted mb-4">
          Surfaces
        </h2>
        <div className="flex gap-3">
          <div className="bg-surface border border-border rounded-lg p-4 text-sm">
            surface
          </div>
          <div className="bg-surface-elevated border border-border rounded-lg p-4 text-sm">
            surface-elevated
          </div>
        </div>
      </section>
    </div>
  );
}
