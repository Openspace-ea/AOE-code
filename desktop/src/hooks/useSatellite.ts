/**
 * 卫星数据 Hook
 */

import { useState, useEffect, useCallback } from 'react'
import satelliteService, { Satellite, OrbitData, SatelliteQuery } from '../services/satellite'

interface SatelliteState {
  satellites: Satellite[]
  total: number
  loading: boolean
  error: string | null
}

export function useSatellites(query?: SatelliteQuery) {
  const [state, setState] = useState<SatelliteState>({
    satellites: [],
    total: 0,
    loading: true,
    error: null
  })

  const load = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const result = await satelliteService.list(query)
      setState({
        satellites: result.satellites,
        total: result.total,
        loading: false,
        error: null
      })
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: String(err)
      }))
    }
  }, [query?.page, query?.limit, query?.search, query?.orbit_type, query?.country, query?.status])

  useEffect(() => {
    load()
  }, [load])

  return {
    ...state,
    refresh: load
  }
}

export function useSatellite(id: string | null) {
  const [satellite, setSatellite] = useState<Satellite | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    setLoading(true)
    satelliteService.get(id)
      .then(data => {
        setSatellite(data)
        setError(null)
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [id])

  return { satellite, loading, error }
}

export function useOrbitData(satelliteId: string | null, params?: { start_date?: string, end_date?: string, limit?: number }) {
  const [orbits, setOrbits] = useState<OrbitData[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!satelliteId) return

    setLoading(true)
    satelliteService.getOrbits(satelliteId, params)
      .then(data => {
        setOrbits(data)
        setError(null)
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [satelliteId, params?.start_date, params?.end_date, params?.limit])

  return { orbits, loading, error }
}

export default useSatellites