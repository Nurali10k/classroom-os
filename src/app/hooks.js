import { useDispatch, useSelector } from 'react-redux'

/** Typed-ish Redux helpers so feature code never imports from `react-redux` directly. */
export const useAppDispatch = () => useDispatch()
export const useAppSelector = useSelector
