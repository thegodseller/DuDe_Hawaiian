'use client'

import { Moon, Sun } from "lucide-react"
import { useTheme } from "@/app/providers/theme-provider"
import { Button } from "@heroui/react"

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <Button
      variant="light"
      isIconOnly
      onPress={toggleTheme}
      aria-label="Toggle theme"
      className="text-foreground"
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </Button>
  )
}