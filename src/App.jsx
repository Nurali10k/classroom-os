import { Suspense } from 'react'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router-dom'

import { store } from './app/store'
import { router } from './app/router'
import { AuthProvider } from './context/AuthContext.jsx'
import ErrorBoundary from './components/shared/ErrorBoundary'
import ThemeProvider from './components/shared/ThemeProvider'
import { PageLoader } from './components/ui/Loader'

export default function App() {
  return (
    <Provider store={store}>
      <ErrorBoundary>
        <ThemeProvider>
          {/* Locale bundles are imported statically, so this boundary only
              covers a deferred language switch — never the first paint. */}
          <Suspense fallback={<PageLoader />}>
            <AuthProvider>
              <RouterProvider router={router} />
            </AuthProvider>
          </Suspense>
        </ThemeProvider>
      </ErrorBoundary>
    </Provider>
  )
}
