import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'

import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { selectSidebarOpen, setSidebarOpen } from '../../features/ui/uiSlice'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import NotificationMonitor from './NotificationMonitor'
import { ToastViewport } from '../ui/Toast'

/**
 * The application shell: fixed sidebar, sticky top bar, scrollable content
 * well, and the global toast stack.
 */
export default function AppLayout() {
  const dispatch = useAppDispatch()
  const sidebarOpen = useAppSelector(selectSidebarOpen)
  const { pathname } = useLocation()
  const reduceMotion = useReducedMotion()

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    dispatch(setSidebarOpen(false))
  }, [pathname, dispatch])

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar open={sidebarOpen} onClose={() => dispatch(setSidebarOpen(false))} />
      <NotificationMonitor />

      <div className="lg:pl-[248px]">
        <Topbar onOpenSidebar={() => dispatch(setSidebarOpen(true))} />

        <motion.main
          key={pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 7 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto w-full max-w-[1200px] px-4 pb-16 pt-6 sm:px-6 lg:px-8"
        >
          <Outlet />
        </motion.main>
      </div>

      <ToastViewport />
    </div>
  )
}
