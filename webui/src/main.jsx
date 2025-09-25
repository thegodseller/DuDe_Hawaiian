import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import LiffUpload from './pages/LiffUpload'

const path = window.location.pathname
const RootComponent = path.startsWith('/liff/upload') ? LiffUpload : App

createRoot(document.getElementById('root')).render(<RootComponent />)
