# Menggunakan image Nginx versi alpine yang sangat ringan
FROM nginx:alpine

# Menyalin file index.html ke dalam direktori default Nginx
COPY . /usr/share/nginx/html/

# Membuka port 80
EXPOSE 80

# Menjalankan Nginx
CMD ["nginx", "-g", "daemon off;"]