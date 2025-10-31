import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-reportes',
  standalone: true, 
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './reportes.html',
  styleUrls: ['./reportes.css']
})
export class ReportesComponent {
  tipoReporte: string = '';
  datosReporte: any[] = [];
  tituloReporte: string = '';
  loading = false;
  error: string | null = null;

  filtros: any = {
    fechaInicio: '',
    fechaFin: '',
    estado: '',
    estadoPedido: '',
    tipoVehiculo: '',
    clienteId: '',
    conductorId: ''
  };

  estadisticasResumen: any[] = [];

  private apiUrl = 'http://localhost:8000/api/v1';

  constructor(private http: HttpClient) {}

  seleccionarReporte(tipo: string) {
    this.tipoReporte = tipo;
    this.datosReporte = [];
    this.error = null;
    this.estadisticasResumen = [];
    this.tituloReporte = `Reporte de ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}`;
  }

  generarReporte() {
    this.error = null;
    this.loading = true;
    let url = '';
    let params = new HttpParams();

    // PEDIDOS
    if (this.tipoReporte === 'pedidos') {
      if (this.filtros.fechaInicio && this.filtros.fechaFin) {
        url = `${this.apiUrl}/reports/orders-by-date`;
        params = params
          .set('start_date', this.filtros.fechaInicio)
          .set('end_date', this.filtros.fechaFin);
      } else if (this.filtros.clienteId) {
        url = `${this.apiUrl}/reports/orders-by-client/${this.filtros.clienteId}`;
      } else {
        url = `${this.apiUrl}/orders`;
      }
    } 
    // CLIENTES
    else if (this.tipoReporte === 'clientes') {
      url = `${this.apiUrl}/clients`;
    } 
    // VEHÍCULOS
    else if (this.tipoReporte === 'vehiculos') {
      url = `${this.apiUrl}/vehicles`;
    } 
    // CONDUCTORES
    else if (this.tipoReporte === 'conductores') {
      const conductorId = this.filtros.conductorId || '1';
      url = `${this.apiUrl}/reports/routes-completed-by-driver/${conductorId}`;
    }

    console.log('🔍 Consultando URL:', url);

    this.http.get<any[]>(url, { params })
      .pipe(
        catchError(err => {
          console.error('❌ Error completo:', err);
          console.error('📍 URL solicitada:', url);
          console.error('📍 Status:', err.status);
          
          let mensajeError = 'Error al generar el reporte.';
          
          if (err.status === 0) {
            mensajeError = '🔴 No se puede conectar al servidor. Verifica que esté corriendo en http://localhost:8000';
          } else if (err.status === 404) {
            mensajeError = 'Endpoint no encontrado. Verifica la configuración del backend.';
          } else if (err.status === 500) {
            mensajeError = 'Error interno del servidor: ' + (err.error?.detail || 'Error desconocido');
          } else {
            mensajeError = err.error?.detail || err.message || mensajeError;
          }
          
          this.error = mensajeError;
          this.loading = false;
          return of([]);
        })
      )
      .subscribe((data) => {
        this.loading = false;
        console.log('✅ Datos recibidos:', data);
        console.log('📊 Total registros:', data?.length || 0);
        
        let datosFiltrados = data || [];
        
        // Filtrar por estado de cliente
        if (this.tipoReporte === 'clientes' && this.filtros.estado) {
          datosFiltrados = datosFiltrados.filter(item => 
            item.status?.toLowerCase() === this.filtros.estado.toLowerCase()
          );
        }
        
        // Filtrar por estado de pedido (mapeo de estados en español/inglés)
        if (this.tipoReporte === 'pedidos' && this.filtros.estadoPedido) {
          const estadoMap: any = {
            'en_proceso': ['en_proceso', 'asignado', 'in_transit'],
            'pendiente': ['pendiente', 'pending'],
            'completado': ['completado', 'entregado', 'delivered'],
            'cancelado': ['cancelado', 'cancelled']
          };
          
          const estadosBuscar = estadoMap[this.filtros.estadoPedido.toLowerCase()] || [this.filtros.estadoPedido.toLowerCase()];
          
          datosFiltrados = datosFiltrados.filter(item => 
            estadosBuscar.includes(item.status?.toLowerCase())
          );
        }
        
        // Filtrar por tipo de vehículo
        if (this.tipoReporte === 'vehiculos' && this.filtros.tipoVehiculo) {
          datosFiltrados = datosFiltrados.filter(item => 
            item.vehicle_type?.toLowerCase() === this.filtros.tipoVehiculo.toLowerCase()
          );
        }
        
        this.datosReporte = datosFiltrados;
        this.calcularEstadisticas();
        
        if (this.datosReporte.length === 0 && data.length > 0) {
          this.error = 'No hay resultados con los filtros aplicados';
          setTimeout(() => this.error = null, 3000);
        }
      });
  }

  limpiarFiltros() {
    this.filtros = {
      fechaInicio: '',
      fechaFin: '',
      estado: '',
      estadoPedido: '',
      tipoVehiculo: '',
      clienteId: '',
      conductorId: ''
    };
    this.datosReporte = [];
    this.estadisticasResumen = [];
  }

  calcularEstadisticas() {
    if (this.tipoReporte === 'pedidos') {
      const total = this.datosReporte.length;
      const completados = this.datosReporte.filter(p => 
        ['completado', 'entregado', 'delivered'].includes(p.status?.toLowerCase())
      ).length;
      const pendientes = this.datosReporte.filter(p => 
        ['pendiente', 'pending'].includes(p.status?.toLowerCase())
      ).length;
      const enProceso = this.datosReporte.filter(p => 
        ['asignado', 'en_proceso', 'in_transit'].includes(p.status?.toLowerCase())
      ).length;
      
      this.estadisticasResumen = [
        { label: 'Total', value: total },
        { label: 'Completados', value: completados },
        { label: 'En Proceso', value: enProceso },
        { label: 'Pendientes', value: pendientes }
      ];
    } else if (this.tipoReporte === 'clientes') {
      const total = this.datosReporte.length;
      const activos = this.datosReporte.filter(c => 
        c.status?.toLowerCase() === 'activo'
      ).length;
      
      this.estadisticasResumen = [
        { label: 'Total', value: total },
        { label: 'Activos', value: activos },
        { label: 'Inactivos', value: total - activos }
      ];
    } else if (this.tipoReporte === 'vehiculos') {
      const total = this.datosReporte.length;
      const disponibles = this.datosReporte.filter(v => 
        v.status?.toLowerCase() === 'disponible'
      ).length;
      
      this.estadisticasResumen = [
        { label: 'Total', value: total },
        { label: 'Disponibles', value: disponibles },
        { label: 'No Disponibles', value: total - disponibles }
      ];
    } else if (this.tipoReporte === 'conductores') {
      const total = this.datosReporte.length;
      
      this.estadisticasResumen = [
        { label: 'Rutas Completadas', value: total }
      ];
    }
  }

  // Métodos para la tabla
  getColumnKeys(): string[] {
    if (!this.datosReporte || this.datosReporte.length === 0) return [];
    return Object.keys(this.datosReporte[0]);
  }

  formatColumnName(key: string): string {
    const translations: any = {
      'id': 'ID',
      'name': 'Nombre',
      'first_name': 'Nombre',
      'last_name': 'Apellido',
      'email': 'Email',
      'phone': 'Teléfono',
      'company': 'Empresa',
      'client_type': 'Tipo Cliente',
      'status': 'Estado',
      'order_number': 'N° Orden',
      'client_id': 'Cliente',
      'driver_id': 'Conductor',
      'vehicle_id': 'Vehículo',
      'origin_address': 'Origen',
      'destination_address': 'Destino',
      'origin_city': 'Ciudad Origen',
      'destination_city': 'Ciudad Destino',
      'priority': 'Prioridad',
      'value': 'Valor',
      'tracking_code': 'Código Rastreo',
      'license_plate': 'Placa',
      'brand': 'Marca',
      'model': 'Modelo',
      'year': 'Año',
      'vehicle_type': 'Tipo Vehículo',
      'document_number': 'Documento',
      'license_type': 'Tipo Licencia',
      'created_at': 'Fecha Creación',
      'updated_at': 'Última Actualización'
    };
    
    return translations[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getColumnValue(item: any, key: string): any {
    const value = item[key];
    if (value === null || value === undefined) return '-';
    
    // Formatear fechas
    if (key.includes('date') || key.includes('_at')) {
      try {
        return new Date(value).toLocaleString('es-CO', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
      } catch {
        return value;
      }
    }
    
    // Formatear estados
    if (key === 'status') {
      const statusMap: any = {
        'pendiente': 'Pendiente',
        'asignado': 'Asignado',
        'entregado': 'Entregado',
        'cancelado': 'Cancelado',
        'activo': 'Activo',
        'inactivo': 'Inactivo',
        'disponible': 'Disponible'
      };
      return statusMap[value?.toLowerCase()] || value;
    }
    
    // Formatear prioridad
    if (key === 'priority') {
      const priorityMap: any = {
        'alta': 'Alta',
        'media': 'Media',
        'baja': 'Baja'
      };
      return priorityMap[value?.toLowerCase()] || value;
    }
    
    // Formatear valores monetarios
    if (key === 'value' && typeof value === 'number') {
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP'
      }).format(value);
    }
    
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
  }

  // Exportar a CSV
  exportarExcel() {
    if (this.datosReporte.length === 0) {
      this.error = 'No hay datos para exportar';
      setTimeout(() => this.error = null, 3000);
      return;
    }

    try {
      const headers = this.getColumnKeys();
      const csvContent = [
        headers.map(h => this.formatColumnName(h)).join(','),
        ...this.datosReporte.map(row => 
          headers.map(h => {
            const val = this.getColumnValue(row, h);
            const strVal = String(val);
            return strVal.includes(',') ? `"${strVal}"` : strVal;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${this.tituloReporte}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error al exportar CSV:', error);
      this.error = 'Error al exportar CSV';
      setTimeout(() => this.error = null, 3000);
    }
  }

  // Exportar a PDF
  exportarPDF() {
    if (this.datosReporte.length === 0) {
      this.error = 'No hay datos para exportar';
      setTimeout(() => this.error = null, 3000);
      return;
    }

    try {
      const headers = this.getColumnKeys().map(k => this.formatColumnName(k));
      
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${this.tituloReporte}</title>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px;
              max-width: 1200px;
              margin: 0 auto;
            }
            h1 { 
              color: #ff7a00; 
              margin-bottom: 10px;
              font-size: 24px;
            }
            .fecha {
              color: #666;
              margin-bottom: 20px;
              font-size: 14px;
            }
            table { 
              width: 100%; 
              border-collapse: collapse; 
              margin-top: 20px;
              font-size: 11px;
            }
            th { 
              background: #ff7a00; 
              color: white; 
              padding: 10px 6px; 
              text-align: left;
              font-weight: 600;
            }
            td { 
              padding: 8px 6px; 
              border-bottom: 1px solid #ddd;
            }
            tr:nth-child(even) {
              background: #f9f9f9;
            }
            .print-button {
              background: #ff7a00;
              color: white;
              padding: 10px 20px;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              margin-bottom: 20px;
              font-size: 14px;
            }
            .print-button:hover {
              background: #e66900;
            }
            @media print {
              .print-button { 
                display: none; 
              }
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          <button class="print-button" onclick="window.print()">🖨️ Imprimir PDF</button>
          <h1>${this.tituloReporte}</h1>
          <div class="fecha">Generado: ${new Date().toLocaleString('es-CO')}</div>
          <table>
            <thead>
              <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${this.datosReporte.map(row => `
                <tr>${this.getColumnKeys().map(k => `<td>${this.getColumnValue(row, k)}</td>`).join('')}</tr>
              `).join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      } else {
        this.error = 'Por favor permite ventanas emergentes para exportar PDF';
        setTimeout(() => this.error = null, 3000);
      }
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      this.error = 'Error al generar vista de impresión';
      setTimeout(() => this.error = null, 3000);
    }
  }

  imprimirReporte() {
    window.print();
  }
}