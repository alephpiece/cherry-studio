import { uuid } from '@renderer/utils'

// @ts-ignore - 忽略类型问题
import PyodideWorker from '../workers/pyodide.worker?worker'

const pyodideWorker = new PyodideWorker()

// 初始化标志
let isInitialized = false
const initPromise = new Promise<void>((resolve, reject) => {
  const timeout = setTimeout(() => {
    reject(new Error('Pyodide initialization timeout'))
  }, 60000) // 60秒初始化超时

  const initHandler = (event: MessageEvent) => {
    if (event.data?.type === 'initialized') {
      clearTimeout(timeout)
      isInitialized = true
      resolve()
      pyodideWorker.removeEventListener('message', initHandler)
    } else if (event.data?.type === 'error') {
      clearTimeout(timeout)
      reject(new Error(`Pyodide initialization failed: ${event.data.error}`))
      pyodideWorker.removeEventListener('message', initHandler)
    }
  }

  pyodideWorker.addEventListener('message', initHandler)
})

// 定义结果类型接口
export interface PyodideOutput {
  result: any
  text: string | null
  error: string | null
}

const resolvers = new Map()

pyodideWorker.onmessage = (event) => {
  // 忽略初始化消息，已由专门的处理器处理
  if (event.data?.type === 'initialized' || event.data?.type === 'error') {
    return
  }

  const { id, output } = event.data

  // 查找对应的解析器
  const resolver = resolvers.get(id)
  if (resolver) {
    resolvers.delete(id)

    // 直接返回整个output对象，不在这一层处理错误
    // 前端可以根据output.error字段来显示错误信息
    resolver.resolve(output)
  }
}

// Pyodide 输出格式化
export function formatPyodideOutput(output: PyodideOutput): string {
  let displayText = ''

  // 优先显示标准输出
  if (output.text) {
    displayText = output.text.trim()
  }

  // 如果有执行结果且无标准输出，显示结果
  if (!displayText && output.result !== null && output.result !== undefined) {
    if (typeof output.result === 'object' && output.result.__error__) {
      displayText = `Result Error: ${output.result.details}`
    } else {
      try {
        displayText = typeof output.result === 'object' ? JSON.stringify(output.result, null, 2) : String(output.result)
      } catch (e) {
        displayText = `Result formatting failed: ${String(e)}`
      }
    }
  }

  // 如果有错误信息，附加显示
  if (output.error) {
    if (displayText) displayText += '\n\n'
    displayText += `Error: ${output.error.trim()}`
  }

  // 如果没有任何输出，提供清晰提示
  if (!displayText) {
    displayText = 'Execution completed with no output.'
  }

  return displayText
}

/**
 * 执行Python脚本
 * @param script 要执行的Python脚本
 * @param context 可选的执行上下文
 * @param timeout 超时时间（毫秒）
 * @returns 格式化后的执行结果
 */
export async function runPythonScript(
  script: string,
  context: Record<string, any> = {},
  timeout: number = 60000
): Promise<string> {
  // 确保Pyodide已初始化
  if (!isInitialized) {
    try {
      await initPromise
    } catch (error: unknown) {
      console.error('Pyodide initialization failed, cannot execute Python code', error)
      return `Initialization failed: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  try {
    const output = await new Promise<PyodideOutput>((resolve, reject) => {
      const id = uuid()

      // 设置消息超时
      const timeoutId = setTimeout(() => {
        resolvers.delete(id)
        reject(new Error('Python execution timed out'))
      }, timeout)

      resolvers.set(id, {
        resolve: (output) => {
          clearTimeout(timeoutId)
          resolve(output)
        },
        reject: (error) => {
          clearTimeout(timeoutId)
          reject(error)
        }
      })

      pyodideWorker.postMessage({
        id,
        python: script,
        context
      })
    })

    return formatPyodideOutput(output)
  } catch (error: unknown) {
    return `System error: ${error instanceof Error ? error.message : String(error)}`
  }
}
