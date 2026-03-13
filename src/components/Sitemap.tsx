import React from 'react';

export function Sitemap() {
  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <h1>Карта сайта</h1>
      <ul style={{ marginTop: '20px', lineHeight: '1.8' }}>
        <li><a href="/">Главная (Авторизация)</a></li>
        <li><a href="/">Список рабочих пространств</a></li>
        <li><a href="/workspace/demo">Пример рабочего пространства (Календарь)</a></li>
      </ul>
      
      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px', fontSize: '14px', color: '#4b5563', maxWidth: '600px' }}>
        <strong>Примечание:</strong> Planaro — это одностраничное приложение (SPA) с закрытым доступом. Функционал (календарь, управление сотрудниками, проектами и отделами) доступен только внутри рабочих пространств после успешной авторизации.
      </div>
    </div>
  );
}
