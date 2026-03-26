import { createRouter, createWebHistory } from 'vue-router';
import AgentDetailPage from './pages/AgentDetailPage.vue';
import ConsolePage from './pages/ConsolePage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import TeamCreatePage from './pages/TeamCreatePage.vue';
import TeamDetailPage from './pages/TeamDetailPage.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: { template: '<div class="route-placeholder"></div>' },
    },
    {
      path: '/teams/new',
      name: 'team-create',
      component: TeamCreatePage,
    },
    {
      path: '/teams/:teamId/rooms/:roomId?',
      name: 'console',
      component: ConsolePage,
    },
    {
      path: '/teams/:teamId/detail',
      name: 'team-detail',
      component: TeamDetailPage,
    },
    {
      path: '/teams/:teamId/settings/:section?',
      name: 'settings',
      component: SettingsPage,
    },
    {
      path: '/teams/:teamId/agents/:agentName',
      name: 'agent-detail',
      component: AgentDetailPage,
    },
  ],
});

export default router;
