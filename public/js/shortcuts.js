document.addEventListener('keydown', (e) => {
  if (!e.altKey || e.ctrlKey || e.metaKey) return;

  // e.code dạng 'KeyN' -> lấy 'N'. Dùng e.code thay vì e.key vì
  // trên một số máy Alt+chữ ra ký tự lạ, e.code thì luôn là phím vật lý
  const key = e.code.replace('Key', '');

  const el = document.querySelector(`[data-key="${key}"]`);  // tìm phần tử có data-key bằng biến key
  if (!el || el.disabled) return;

  e.preventDefault(); // chặn trình duyệt xử lý phím này theo kiểu của nó
  if (el.tagName === 'INPUT') { el.focus(); el.select(); }
  else el.click();
});