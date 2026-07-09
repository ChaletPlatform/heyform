import { helper } from '@heyform-inc/utils'

export function requestParser(req: any, keys: string[]): any {
  const sources = ['body', 'query', 'params']
  let value: any

  for (const source of sources) {
    const obj = req[source]

    if (helper.isEmpty(obj)) {
      continue
    }

    for (const key of keys) {
      const searchValue = obj[key]

      if (helper.isValid(searchValue)) {
        value = searchValue
        break
      }
    }
  }

  return value
}
