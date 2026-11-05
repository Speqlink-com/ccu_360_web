# CCU360 supplied icons

The application now uses the supplied PNG/WebP artwork directly, preserving its colours and transparency. Icons are decorative beside accessible text labels.

| Supplied file in `public/icons/` | Mapping |
| --- | --- |
| `profile-icon.webp` | Signed-in profile, team and employee metrics |
| `add-user.png` | Employees navigation, employee creation, workforce metrics |
| `verified-check-icon.webp` | Access, role and facility trust context |
| `progress-bar.webp` | Platform/facility activity metrics |
| `left-chevron.webp` | Patient back navigation |
| `right-chevron.png` | Row/detail navigation |
| `dropdown-icon.webp` | Select-field arrows |
| `invoice-icon.png` | Registered as the output/document icon for future output surfaces |

The registry is `components/ui/icon.tsx`. Files render as images rather than CSS colour masks. Tailwind/global CSS contains the select-arrow reference. Remaining workflow icons use consistent Lucide placeholders.

Optional future custom assets: `unit-overview`, `facility`, `patient-360`, `round-360`, `action-360`, `connect-360`, `handover-360`, `bed-location`, `search`, `clock`, and `sign-out`. Supply SVG, transparent PNG or WebP and register its actual filename; extensions are not assumed.
