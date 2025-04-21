import { styleSheetSerializer } from 'jest-styled-components/serializer'
import { expect } from 'vitest'

expect.addSnapshotSerializer(styleSheetSerializer)
