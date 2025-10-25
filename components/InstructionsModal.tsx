import React from 'react';
import { Modal } from './Modal';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstructionsModal: React.FC<InstructionsModalProps> = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Інструкція з використання">
      <div className="text-slate-300 max-h-[70vh] overflow-y-auto pr-2 space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">1. Початок роботи</h2>
          <p>
            На головному екрані натисніть кнопку <strong>"Get Started"</strong>. Відкриється вікно, де ви можете обрати джерело слів:
          </p>
          <ul className="list-disc list-inside space-y-2 mt-3">
            <li><strong>Built-in:</strong> Вибрати один із готових, вбудованих словників. Деякі з них містять файли з прикладами речень.</li>
            <li><strong>From Computer:</strong> Завантажити власний файл зі словами у форматі Excel (.xlsx).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">2. Підготовка файлів</h2>
          
          <h3 className="text-lg font-semibold mb-1 text-slate-100">Словник слів (.xlsx)</h3>
          <p className="mb-3">
            Для створення власного набору карток, ваш файл Excel має відповідати чіткій структурі:
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Колонка A:</strong> Слово російською або українською мовою.</li>
            <li><strong>Колонка B:</strong> <em>Має бути порожньою.</em></li>
            <li><strong>Колонка C:</strong> Переклад англійською мовою.</li>
            <li><strong>Колонка D:</strong> <em>Має бути порожньою.</em></li>
          </ul>
          <div className="mt-4 p-3 bg-slate-900 rounded-lg">
            <p className="font-mono text-xs text-slate-400">Приклад структури для кількох наборів:</p>
            <pre className="text-slate-300 whitespace-pre-wrap text-xs"><code>
{`|    A    | B |     C     | D |    E    | F |    G    |
|---------|---|-----------|---|---------|---|---------|
|   кот   |   |    cat    |   |  зелений|   |  green  |
| собака  |   |    dog    |   | червоний|   |   red   |`}
            </code></pre>
          </div>
          <p className="mt-3">
            Ви можете розміщувати кілька наборів слів на одному аркуші. Наступний набір починатиметься з колонки <strong>E</strong>, потім <strong>I</strong>, і так далі (з кроком у 4 колонки).
          </p>
          <p className="mt-3">
            <strong>Важливо:</strong> Якщо у вашому наборі більше 30 слів, він буде автоматично розділений на менші частини для зручнішого вивчення.
          </p>

          <h3 className="text-lg font-semibold mt-4 mb-1 text-slate-100">Речення-приклади (опціонально)</h3>
          <p className="mb-3">
            Щоб бачити слова в контексті, ви можете завантажити файл із прикладами. Це можна зробити на екрані тренування.
          </p>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Формат .xlsx:</strong> <strong>Колонка A</strong> — англійське слово, <strong>Колонка B</strong> — речення-приклад.</li>
            <li><strong>Формат .json:</strong> Об'єкт, де ключ — англійське слово (в нижньому регістрі), а значення — речення.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">3. Процес тренування</h2>
          <ul className="list-disc list-inside space-y-2">
            <li><strong>Вибір набору:</strong> Після завантаження файлу оберіть один із доступних наборів слів для початку. Слова в наборі автоматично перемішуються.</li>
            <li><strong>Перевертання картки:</strong> Натисніть на картку, щоб побачити переклад.</li>
            <li><strong>Кнопки "Know" / "Don't know":</strong> Натискайте <strong>"Know"</strong>, якщо знаєте слово. Якщо ні — тисніть <strong>"Don't know"</strong>. Невідоме слово буде збережено для окремого тренування.</li>
            <li><strong>Прослуховування:</strong> Натисніть іконку динаміка біля англійського слова або речення, щоб почути якісну вимову.</li>
            <li><strong>Перемішування:</strong> У будь-який момент натисніть на іконку з двома стрілками, щоб перемішати поточний набір слів.</li>
            <li><strong>Список слів:</strong> Натисніть на іконку зі стрілками вгору-вниз, щоб показати або приховати повний список слів у поточному наборі.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">4. Тренування невідомих слів</h2>
          <p>
            Після завершення основного набору, якщо були слова, відмічені як "Don't know", з'явиться кнопка для їх тренування. Цей режим дозволяє зосередитись на найскладнішому матеріалі.
          </p>
          <p className="mt-3">
            Коли в режимі тренування ви натискаєте "Know", слово видаляється зі списку невідомих. Ваш прогрес зберігається у браузері, тож ви можете повернутися до тренування пізніше.
          </p>
        </section>
        
        <section>
          <h2 className="text-xl font-semibold mb-2 text-indigo-400">5. Керування реченнями</h2>
          <p>
            На екрані тренування, під кнопками "Know"/"Don't know", є блок для керування реченнями-прикладами. Ви можете завантажити новий файл (речення з нього будуть додані до існуючих) або очистити всю базу речень.
          </p>
        </section>
      </div>
    </Modal>
  );
};