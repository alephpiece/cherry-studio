export type TraceProviderType = 'langfuse'

export type LangfuseSettings = {
  traceName: string
  baseUrl: string
  publicKey: string
  secretKey: string
}
