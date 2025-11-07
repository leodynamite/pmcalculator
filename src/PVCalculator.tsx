import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Простой компонент всплывающей подсказки на Tailwind (без внешних зависимостей)
function Tooltip({ message }: { message: string }) {
  return (
    <span className="relative inline-block group align-middle select-none">
      <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-semibold rounded-full bg-gray-200 text-gray-600 cursor-default">?</span>
      <span
        className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 whitespace-normal rounded-md bg-gray-900 px-3 py-2 text-xs leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
        role="tooltip"
      >
        {message}
      </span>
    </span>
  )
}

// Типы данных
interface PVRow {
  id: number
  pv: number
}

interface CalculationRow extends PVRow {
  rateOver15: number
  rateOver15Rounded: number
  rateUnder15: number
  rateUnder15Rounded: number
  totalBuyout: number
  marketCheck: number // выкупная стоимость / 2
  percentFromCarPrice: number // (сумма выкупа / стоимость авто) * 100
  checkStatus: 'good' | 'warning' | 'bad' // Статус сверки
}

// Утилита для форматирования суммы
const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('ru-RU').format(Math.round(amount))
}

// Округление вверх до 50₽
const roundUpTo50 = (value: number): number => {
  return Math.ceil(value / 50) * 50
}

// Определение статуса сверки по проценту
const getCheckStatus = (percent: number): 'good' | 'warning' | 'bad' => {
  if (percent >= 90 && percent <= 110) return 'good'
  if ((percent >= 80 && percent < 90) || (percent > 110 && percent <= 120)) return 'warning'
  return 'bad'
}

// Расчёт всех значений для строки
const calculateRow = (
  pv: number,
  rateAtZero: number,
  diffUnder15: number,
  daysInMonth: number,
  months: number,
  carPrice: number
): Omit<CalculationRow, 'id' | 'pv'> => {
  // 1. Сначала считаем базовую выкупную стоимость БЕЗ ПВ: Ставка × дни × месяцы
  // Используем ставку при ПВ=0 (rateAtZero) для базовой выкупной стоимости
  const baseBuyout = Math.round(rateAtZero * daysInMonth * months)
  
  // 2. Выкупная стоимость с учётом ПВ = Базовая выкупная стоимость - (ПВ × 1.8)
  const totalBuyout = Math.max(0, Math.round(baseBuyout - pv * 1.8))
  
  // 3. Ставка в сутки вычисляется ОБРАТНО: Выкупная стоимость / дни / месяцы
  const rateOver15 = totalBuyout / daysInMonth / months
  const rateOver15Rounded = roundUpTo50(rateOver15)

  // Ставка <15дн
  const rateUnder15 = rateOver15Rounded + diffUnder15
  const rateUnder15Rounded = roundUpTo50(rateUnder15)

  // Сверка = Выкупная стоимость / 2
  const marketCheck = Math.round(totalBuyout / 2)

  // Процент от стоимости авто (для проверки попадает ли выкупная стоимость в диапазон)
  const percentFromCarPrice = carPrice > 0 
    ? (totalBuyout / carPrice) * 100 
    : 0

  // Статус сверки
  const checkStatus = getCheckStatus(percentFromCarPrice)

  return {
    rateOver15,
    rateOver15Rounded,
    rateUnder15,
    rateUnder15Rounded,
    totalBuyout,
    marketCheck,
    percentFromCarPrice,
    checkStatus,
  }
}

export default function PVCalculator() {
  // Основные параметры (жёлтые поля)
  const [clientName, setClientName] = useState<string>('Иван')
  const [carModel, setCarModel] = useState<string>('Toyota Camry')
  const [carPrice, setCarPrice] = useState<number>(6500000) // Стоимость автомобиля (ориентир)
  const [deposit, setDeposit] = useState<number>(200000)
  const [rateAtZero, setRateAtZero] = useState<number>(3900)
  const [diffUnder15, setDiffUnder15] = useState<number>(200)
  const [daysInMonth, setDaysInMonth] = useState<number>(30.5)
  const [months, setMonths] = useState<number>(55)

  // Список ПВ
  const [pvRows, setPvRows] = useState<PVRow[]>([
    { id: 1, pv: 0 },
    { id: 2, pv: 500000 },
    { id: 3, pv: 800000 },
    { id: 4, pv: 1000000 },
  ])

  // Рассчитываем все строки
  const calculatedRows = useMemo<CalculationRow[]>(() => {
    return pvRows.map((row) => ({
      ...row,
      ...calculateRow(
        row.pv,
        rateAtZero,
        diffUnder15,
        daysInMonth,
        months,
        carPrice
      ),
    }))
  }, [pvRows, rateAtZero, diffUnder15, daysInMonth, months, carPrice])

  // Обновление ПВ
  const updatePV = (id: number, value: number) => {
    setPvRows(pvRows.map((row) => (row.id === id ? { ...row, pv: value } : row)))
  }

  // Добавление новой строки ПВ
  const addPVRow = () => {
    const newId = Math.max(...pvRows.map((r) => r.id), 0) + 1
    setPvRows([...pvRows, { id: newId, pv: 0 }])
  }

  // Удаление строки
  const deletePVRow = (id: number) => {
    if (pvRows.length > 1) {
      setPvRows(pvRows.filter((row) => row.id !== id))
    }
  }

  // Генерация текста для клиента
  const generateClientText = (): string => {
    if (calculatedRows.length === 0) return ''

    let text = `Необходимо отправить расчет клиенту ${clientName}\n\n`
    text += `Добрый день,\n`
    text += `Для аренды с выкупом ${carModel} - математика будет примерно следующая:\n\n`

    calculatedRows.forEach((row) => {
      const formattedPV = formatAmount(row.pv)
      const formattedDeposit = formatAmount(deposit)
      const formattedRate = formatAmount(row.rateOver15Rounded)
      const formattedRateUnder15 = formatAmount(row.rateUnder15Rounded)

      text += `ПВ ${formattedPV} ₽ + депозит ${formattedDeposit} ₽ + 15 дней:\n`
      text += `ставка ${formattedRate} ₽/сут (${formattedRateUnder15} ₽ при оплате менее 15 дней)\n`
      text += `срок ${months} мес.\n\n`
    })

    return text
  }

  // Копирование текста
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateClientText())
      alert('Текст скопирован в буфер обмена!')
    } catch (err) {
      console.error('Ошибка при копировании:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          VK Cars — Калькулятор ПВ
        </h1>

        {/* Основные параметры (жёлтые поля) */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Основные параметры
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Имя клиента
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Авто
              </label>
              <input
                type="text"
                value={carModel}
                onChange={(e) => setCarModel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Стоимость автомобиля (ориентир) (₽)
              </label>
              <input
                type="number"
                value={carPrice}
                onChange={(e) => setCarPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Рыночная стоимость для сверки
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1">
                  Депозит (₽)
                  <Tooltip message="За ориентир необходимо брать условия по любому авто с аналогичной рыночной стоимостью" />
                </span>
              </label>
              <input
                type="number"
                value={deposit}
                onChange={(e) => setDeposit(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1">
                  Базовая ставка при ПВ=0 (&gt;15дн) (₽/сут)
                  <Tooltip message="За ориентир необходимо брать условия по любому авто с аналогичной рыночной стоимостью" />
                </span>
              </label>
              <input
                type="number"
                value={rateAtZero}
                onChange={(e) => setRateAtZero(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Разница ставок для &lt;15дн (₽)
              </label>
              <input
                type="number"
                value={diffUnder15}
                onChange={(e) => setDiffUnder15(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Дней в месяце
              </label>
              <input
                type="number"
                step="0.1"
                value={daysInMonth}
                onChange={(e) => setDaysInMonth(parseFloat(e.target.value) || 30.5)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1">
                  Срок выкупа (мес)
                  <Tooltip message="За ориентир необходимо брать условия по любому авто с аналогичной рыночной стоимостью" />
                </span>
              </label>
              <input
                type="number"
                value={months}
                onChange={(e) => setMonths(parseInt(e.target.value) || 55)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>
          </div>
        </div>

        {/* Таблица расчётов */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              Расчёты по ПВ
            </h2>
            <button
              onClick={addPVRow}
              className="px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors flex items-center gap-2"
            >
              <span className="text-xl">+</span> Добавить ПВ
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">
                    ПВ (₽)
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">
                    Ставка &gt;15дн (₽/сут)
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">
                    Округление &gt;15дн
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">
                    Ставка &lt;15дн (₽/сут)
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">
                    Выкупная стоимость (₽)
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">
                    <div className="flex items-center gap-1">
                      Сверка (₽)
                      <Tooltip message="Значение должно быть примерно равно рыночной стоимости или немного выше неё" />
                    </div>
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">
                    Процент от стоимости авто
                  </th>
                  <th className="border border-gray-300 px-4 py-2 text-left text-sm font-medium text-gray-700">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {calculatedRows.map((row) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="hover:bg-gray-50"
                    >
                      <td className="border border-gray-300 px-4 py-2">
                        <input
                          type="number"
                          value={row.pv}
                          onChange={(e) => updatePV(row.id, parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded bg-yellow-100 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        />
                      </td>
                      <td className="border border-gray-300 px-4 py-2 bg-white">
                        <div className="px-2 py-1 text-gray-700">
                          {formatAmount(row.rateOver15)}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-2 bg-white">
                        <div className="px-2 py-1 text-gray-700 font-medium">
                          {formatAmount(row.rateOver15Rounded)}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-2 bg-white">
                        <div className="px-2 py-1 text-gray-700 font-medium">
                          {formatAmount(row.rateUnder15Rounded)}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-2 bg-white">
                        <div className="px-2 py-1 text-gray-700 font-semibold">
                          {formatAmount(row.totalBuyout)}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-2 bg-white">
                        <div className="px-2 py-1 text-gray-700 font-medium">
                          {formatAmount(row.marketCheck)}
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-2 bg-white">
                        <div 
                          className={`px-2 py-1 font-semibold ${
                            row.checkStatus === 'good' 
                              ? 'text-green-600 bg-green-50' 
                              : row.checkStatus === 'warning'
                              ? 'text-orange-600 bg-orange-50'
                              : 'text-red-600 bg-red-50'
                          } rounded`}
                          title={
                            row.checkStatus === 'good'
                              ? 'В норме (90-110%)'
                              : row.checkStatus === 'warning'
                              ? 'Предупреждение (80-90% или 110-120%)'
                              : 'Вне нормы (<80% или >120%)'
                          }
                        >
                          <span className="mr-1">
                            {row.checkStatus === 'good' ? '🟢' : row.checkStatus === 'warning' ? '🟠' : '🔴'}
                          </span>
                          {row.percentFromCarPrice.toFixed(1)}%
                        </div>
                      </td>
                      <td className="border border-gray-300 px-4 py-2">
                        <button
                          onClick={() => deletePVRow(row.id)}
                          disabled={pvRows.length <= 1}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm disabled:bg-gray-300 disabled:cursor-not-allowed"
                          title="Удалить строку"
                        >
                          🗑
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </div>

        {/* Текст для клиента */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Текст для отправки клиенту
          </h2>
          <textarea
            readOnly
            value={generateClientText()}
            className="w-full h-64 px-4 py-3 border border-gray-300 rounded-md bg-gray-50 font-mono text-sm resize-none"
          />
          <button
            onClick={copyToClipboard}
            className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            Скопировать текст
          </button>
        </div>
      </div>
    </div>
  )
}

