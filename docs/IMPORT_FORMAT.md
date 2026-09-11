# Import Format

## Canonical ZIP Structure

```
teambeelding-package.zip
├── teambeelding-import.xlsx
└── images/
    ├── game-key-1/
    │   ├── picture-001.jpg
    │   └── picture-002.png
    └── game-key-2/
        └── picture-001.webp
```

Image paths in the workbook are relative to the `images/` folder inside the ZIP.
Example: `game-key-1/picture-001.jpg`

---

## Workbook Sheets

### Manifest (required)

| Column | Type | Description |
|---|---|---|
| schema_version | Number | Must be `1` |
| package_name | String | Human-readable name for this package |
| exported_at | String | ISO date string of when this was exported |
| application | String | Must be `TeamBeelding` |

### Games (required)

| Column | Type | Required | Description |
|---|---|---|---|
| game_key | String | Yes | Unique stable key within this package |
| title | String | Yes | Display title |
| description | String | No | Short description |
| estimated_duration_minutes | Number | No | Approx play time |
| question_order_mode | Enum | Yes | `EXACT` or `RANDOM` |
| default_duration_seconds | Number | Yes | 5–120, default 15 |
| incorrect_penalty_points | Number | Yes | ≥ 0, default 0 |
| published | Boolean | Yes | `TRUE` or `FALSE` (always imported as draft) |

### Rounds (required)

| Column | Type | Required | Description |
|---|---|---|---|
| game_key | String | Yes | Reference to Games.game_key |
| round_key | String | Yes | Unique stable key within this package |
| round_number | Number | Yes | Display order (positive integer) |
| title | String | Yes | Round display name |
| description | String | No | Round description |
| game_type | Enum | Yes | `NAME_THE_SONG` or `GUESS_THE_PICTURE` |
| category | String | No | Optional category |
| subcategory | String | No | Optional subcategory |
| difficulty | String | No | Optional difficulty label |
| question_order_mode | Enum | Yes | `EXACT` or `RANDOM` |

### Questions (required)

| Column | Type | Required | Description |
|---|---|---|---|
| game_key | String | Yes | Reference to Games.game_key |
| round_key | String | Yes | Reference to Rounds.round_key |
| question_key | String | Yes | Unique stable key within this package |
| question_number | Number | Yes | Display order within round |
| game_type | Enum | Yes | `NAME_THE_SONG` or `GUESS_THE_PICTURE` |
| prompt | String | Yes | Question text |
| lyric_excerpt | String | NAME_THE_SONG | Lyric excerpt shown to players |
| song_title | String | NAME_THE_SONG | Revealed after answer |
| artist | String | NAME_THE_SONG | Revealed after answer |
| image_path | String | GUESS_THE_PICTURE | Path relative to `images/` in ZIP |
| category | String | No | Optional category |
| subcategory | String | No | Optional subcategory |
| difficulty | String | No | Optional difficulty |
| duration_seconds | Number | Yes | 5–120 |
| correct_choice_key | String | Yes | Must match a Choices.choice_key for this question |
| is_tiebreaker | Boolean | Yes | `TRUE` or `FALSE` |
| active | Boolean | Yes | `TRUE` or `FALSE` |

### Choices (required)

| Column | Type | Required | Description |
|---|---|---|---|
| question_key | String | Yes | Reference to Questions.question_key |
| choice_key | String | Yes | Unique within this question |
| choice_order | Number | Yes | Must be exactly 1, 2, or 3 |
| choice_text | String | Yes | Answer text displayed to players |

---

## Allowed Values

### game_type
- `NAME_THE_SONG`
- `GUESS_THE_PICTURE`

### question_order_mode
- `EXACT` — follows question_number order
- `RANDOM` — shuffled at room creation time, same for all players

### Boolean fields
Accepted values: `TRUE`, `FALSE`, `1`, `0`, `YES`, `NO` (case-insensitive)

---

## Image Requirements

- Formats: JPEG (`.jpg`, `.jpeg`), PNG (`.png`), WebP (`.webp`)
- Max size per image: 5 MB
- Max total package size: 100 MB
- Max workbook size: 10 MB
- Paths must not contain `../` (path traversal is rejected)
- Paths must not start with `/`

---

## Validation Rules

The import is rejected entirely if any error exists. Warnings are allowed.

### Errors (blocking)
- Missing required sheets
- Missing required columns
- Unsupported schema version
- Duplicate game_key / round_key / question_key
- Duplicate choice_key within a question
- Orphaned round (unknown game_key)
- Orphaned question (unknown round_key)
- Orphaned choice (unknown question_key)
- Wrong number of choices (must be exactly 3 per question)
- Choice orders not exactly {1, 2, 3}
- correct_choice_key not found among the question's choices
- duration_seconds outside 5–120
- incorrect_penalty_points < 0
- Missing lyric_excerpt / song_title / artist for NAME_THE_SONG
- Missing image_path for GUESS_THE_PICTURE
- image_path references a file not in the ZIP
- Path traversal characters in image_path
- Unsupported image file format
- Image exceeds 5 MB
- More than 500 active questions per package

### Warnings (non-blocking)
- Image in ZIP not referenced by any question

---

## Error Format

Each validation error contains:

```typescript
{
  sheet: string;        // e.g. "Questions"
  row?: number;         // 1-indexed row in sheet (2 = first data row)
  column?: string;      // e.g. "image_path"
  errorCode: string;    // e.g. "MISSING_IMAGE_FILE"
  message: string;      // Human-readable description
  isWarning: boolean;   // true = warning, false = blocking error
}
```

---

## Export Compatibility

The built-in game export produces a ZIP in this exact format with:
- `schema_version = 1`
- `application = TeamBeelding`

An exported package can be re-imported without modification. The importer always treats imported games as unpublished (draft) regardless of the `published` column value.

---

## Schema Versioning

The `schema_version` field in the Manifest sheet identifies the format version. Only version `1` is supported in this release. Future versions will be documented here with migration notes.
