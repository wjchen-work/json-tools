import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'json-tool',
      component: () => import('@/views/JsonToolView.vue'),
    },
  ],
})

export default router
