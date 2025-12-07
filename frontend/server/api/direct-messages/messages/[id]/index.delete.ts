export default defineEventHandler(async (event) => {
  const messageId = getRouterParam(event, 'id')
  const $api = await createValidatedFetch(event)

  await $api(`/api/direct-messages/messages/${messageId}`, {
    method: 'DELETE'
  })

  return null
})
