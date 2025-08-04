'use client'

import * as React from 'react'
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts'

import { useIsMobile } from '@/hooks/use-mobile'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { adminApiClient } from '@/lib/api/admin-client'

export const description = 'An interactive area chart'

const chartConfig = {
  sessions: {
    label: 'Sessions',
  },
  questions: {
    label: 'Questions',
    color: 'var(--primary)',
  },
  gestures: {
    label: 'Gestures',
    color: 'var(--primary)',
  },
} satisfies ChartConfig

interface ChartDataPoint {
  date: string
  questions: number
  gestures: number
}

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState('90d')
  const [chartData, setChartData] = React.useState<ChartDataPoint[]>([])

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange('7d')
    }
  }, [isMobile])

  React.useEffect(() => {
    const fetchChartData = async () => {
      try {
        const response = await adminApiClient.getGestureAnalytics({
          timeframe: timeRange,
          format: 'timeseries',
        })

        if (response.success && response.data) {
          const timeseriesData = response.data.timeseries ?? []
          const transformedData: ChartDataPoint[] = timeseriesData.map((item: Record<string, unknown>) => ({
            date: typeof item.date === 'string' ? item.date : new Date().toISOString(),
            questions: typeof item.questions === 'number' ? item.questions : 0,
            gestures: typeof item.gestures === 'number' ? item.gestures : 0,
          }))
          setChartData(transformedData)
        } else {
          console.error('Failed to fetch chart data:', response.error)
          // Keep current data on error - no fallback to dummy data
        }
      } catch (error) {
        console.error('Error fetching chart data:', error)
        // Keep current data on error - no fallback to dummy data
      }
    }

    void fetchChartData()
  }, [timeRange])

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date)
    const now = new Date()
    let daysToSubtract = 90
    if (timeRange === '30d') {
      daysToSubtract = 30
    } else if (timeRange === '7d') {
      daysToSubtract = 7
    }
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Gesture Activity</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">Questions and gestures processed over time</span>
          <span className="@[540px]/card:hidden">Activity over time</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillQuestions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-questions)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-questions)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillGestures" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-gestures)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-gestures)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              defaultIndex={isMobile ? -1 : 10}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="gestures"
              type="natural"
              fill="url(#fillGestures)"
              stroke="var(--color-gestures)"
              stackId="a"
            />
            <Area
              dataKey="questions"
              type="natural"
              fill="url(#fillQuestions)"
              stroke="var(--color-questions)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
